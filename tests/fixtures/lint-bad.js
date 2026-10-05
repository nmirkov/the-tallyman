// Purpose-built bad content for tests/unit/lint.test.js (TT-006). Each case mutates a
// fresh copy of the mini-world so that it violates exactly the named rule (other rules
// may fire as a consequence; the test only requires the named one).

import miniWorld from './mini-world.js';

/** Deep clone that keeps functions (hooks) by reference. */
export function cloneContent(v) {
  if (Array.isArray(v)) return v.map(cloneContent);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cloneContent(x)]));
  return v;
}

/** A fresh, mutable copy of the mini-world. */
export const freshMini = () => cloneContent(miniWorld);

const art40 = (h, row = ' ') => ({ w: 40, h, chars: Array(h).fill(row.repeat(40)), colors: Array(h).fill('1'.repeat(40)) });

/**
 * @type {Array<{rule: string, level: 'error'|'warning', name: string, strict?: boolean,
 *   mutate: (c: any) => void}>}
 */
export const BAD_WORLDS = [
  // L01 schema
  { rule: 'L01', level: 'error', name: 'unknown room field', mutate: (c) => { c.rooms.square.colour = 'red'; } },
  { rule: 'L01', level: 'error', name: 'missing required item field', mutate: (c) => { delete c.items.torch.desc; } },
  { rule: 'L01', level: 'error', name: 'wrong field type', mutate: (c) => { c.rooms.cellar.dark = 'yes'; } },
  { rule: 'L01', level: 'error', name: 'missing top-level table', mutate: (c) => { delete c.scoring; } },
  { rule: 'L01', level: 'error', name: 'unknown top-level key', mutate: (c) => { c.monsters = {}; } },
  { rule: 'L01', level: 'error', name: 'hook is not a function', mutate: (c) => { c.hooks.is_late = 'yes'; } },
  // L02 ids
  { rule: 'L02', level: 'error', name: 'id not snake_case', mutate: (c) => { c.items.Lamp = { name: 'lamp', names: ['lamp'], desc: 'A lamp.', location: 'pub' }; } },
  { rule: 'L02', level: 'error', name: 'item id collides with a room id', mutate: (c) => { c.items.pub = { name: 'pub sign', names: ['sign'], desc: 'A sign.', location: 'square' }; } },
  { rule: 'L02', level: 'error', name: 'reserved id player', mutate: (c) => { c.npcs.player = { name: 'you', names: ['you'], desc: 'You.', location: null }; } },
  { rule: 'L02', level: 'error', name: 'topic id collides with an entity', mutate: (c) => { c.topics.torch = { names: ['light'] }; } },
  { rule: 'L02', level: 'error', name: 'duplicate beat id', mutate: (c) => { c.beats.push({ id: 'bell', at: 10, run: 'Dong.' }); } },
  { rule: 'L02', level: 'error', name: 'var name not camelCase', mutate: (c) => { c.vars.bad_var = { type: 'int', init: 0 }; } },
  // L03 references
  { rule: 'L03', level: 'error', name: 'exit to unknown room', mutate: (c) => { c.rooms.pub.exits.n = 'attic'; } },
  { rule: 'L03', level: 'error', name: 'item location unknown', mutate: (c) => { c.items.brass_key.location = 'attic'; } },
  { rule: 'L03', level: 'error', name: 'item inside a non-container', mutate: (c) => { c.items.brass_key.location = 'torch'; } },
  { rule: 'L03', level: 'error', name: 'unknown keyId', mutate: (c) => { c.items.oak_door.keyId = 'skeleton_key'; } },
  { rule: 'L03', level: 'error', name: 'door item not openable', mutate: (c) => { c.rooms.alley.exits.n = { to: 'square', door: 'brass_key' }; } },
  { rule: 'L03', level: 'error', name: 'award unknown in a reaction', mutate: (c) => { c.items.torch.after.turn_on.award = 'torch_on'; } },
  { rule: 'L03', level: 'error', name: 'var unknown in a condition', mutate: (c) => { c.endings[0].when = { var: 'pikeStat', eq: 'restrained' }; } },
  { rule: 'L03', level: 'error', name: 'unknown start room', mutate: (c) => { c.rules.start = 'attic'; } },
  { rule: 'L03', level: 'error', name: 'unknown safe room', mutate: (c) => { c.zones.town.safeRoom = 'attic'; } },
  { rule: 'L03', level: 'error', name: 'unknown case culprit', mutate: (c) => { c.case.culprit = 'harrow'; } },
  { rule: 'L03', level: 'error', name: 'unknown ending in end effect', mutate: (c) => { c.case.wrong = { end: 'wrong_woman' }; } },
  { rule: 'L03', level: 'error', name: 'NPC topic key unknown', mutate: (c) => { c.npcs.maggie.topics.weather = 'Wet.'; } },
  { rule: 'L03', level: 'error', name: 'hazard exit missing in its room', mutate: (c) => { c.hazards.drain.exit = 'n'; } },
  // L04 condition / reaction shapes
  { rule: 'L04', level: 'error', name: 'condition with two keys', mutate: (c) => { c.rooms.alley.exits.e.if = { flag: 'gate_unbolted', in: 'alley' }; } },
  { rule: 'L04', level: 'error', name: 'unknown condition key', mutate: (c) => { c.hints[0].done = { awardd: 'torch_lit' }; } },
  { rule: 'L04', level: 'error', name: 'unknown reaction key', mutate: (c) => { c.npcs.maggie.talk = { sya: 'Hello.' }; } },
  { rule: 'L04', level: 'error', name: 'setVar value does not fit its VarDecl', mutate: (c) => { c.daemons[0].run.setVar = { bells: 'many' }; } },
  { rule: 'L04', level: 'error', name: 'var comparison value does not fit', mutate: (c) => { c.endings[0].when = { var: 'pikeState', eq: 'restrainted' }; } },
  { rule: 'L04', level: 'error', name: 'unknown placeholder', mutate: (c) => { c.rooms.pub.desc = 'It is {weather} outside.'; } },
  { rule: 'L04', level: 'warning', name: 'last text variant has a condition', mutate: (c) => { c.items.torch.desc = [{ if: { on: 'torch' }, text: 'Lit.' }]; } },
  // L05 exits
  { rule: 'L05', level: 'error', name: 'non-reciprocal exit', mutate: (c) => { c.rooms.pub.exits.n = 'office'; } },
  { rule: 'L05', level: 'error', name: 'unknown direction', mutate: (c) => { c.rooms.pub.exits.north = 'square'; } },
  // L06
  { rule: 'L06', level: 'error', name: 'one-way exit without a hazard', mutate: (c) => { delete c.hazards.drain; } },
  // L07
  { rule: 'L07', level: 'error', name: 'unreachable rooms', mutate: (c) => {
    c.rooms.attic = { name: 'Attic', zone: 'town', picture: 'square', desc: 'Dusty.', exits: { d: 'loft' } };
    c.rooms.loft = { name: 'Loft', zone: 'town', picture: 'square', desc: 'Dustier.', exits: { u: 'attic' } };
  } },
  // L08
  { rule: 'L08', level: 'error', name: 'critical item never obtainable', mutate: (c) => { c.items.torch.location = null; } },
  { rule: 'L08', level: 'error', name: 'critical item in an unreachable room', mutate: (c) => {
    c.rooms.attic = { name: 'Attic', zone: 'town', picture: 'square', desc: 'Dusty.', exits: {} };
    c.items.handcuffs.location = 'attic';
  } },
  // L09
  { rule: 'L09', level: 'error', name: 'curly quote in prose', mutate: (c) => { c.rooms.pub.desc = 'Maggie’s pub.'; } },
  { rule: 'L09', level: 'error', name: 'accented letter in a name', mutate: (c) => { c.npcs.maggie.name = 'Maggé'; } },
  // L10
  { rule: 'L10', level: 'error', name: 'room description too long', mutate: (c) => { c.rooms.pub.desc = 'x'.repeat(301); } },
  { rule: 'L10', level: 'error', name: 'room description variant too long', mutate: (c) => { c.rooms.square.desc[1].text = 'y'.repeat(301); } },
  // L11
  { rule: 'L11', level: 'error', name: 'art row too short', mutate: (c) => { c.art.pub.chars[3] = 'short'; } },
  { rule: 'L11', level: 'error', name: 'art colour key invalid', mutate: (c) => { c.art.pub.colors[0] = 'z'.repeat(40); } },
  { rule: 'L11', level: 'error', name: 'art fx unknown', mutate: (c) => { c.art.pub.fx = ['snow']; } },
  { rule: 'L11', level: 'error', name: 'art glyph not in the font', mutate: (c) => { c.art.pub.chars[2] = '€'.repeat(40); } },
  { rule: 'L11', level: 'error', name: 'art id mismatch', mutate: (c) => { c.art.pub.id = 'tavern'; } },
  { rule: 'L11', level: 'error', name: 'room picture with screen-sized art', mutate: (c) => { c.art.pub = { id: 'pub', ...art40(25) }; } },
  // L12
  { rule: 'L12', level: 'warning', name: 'room without picture (incremental)', mutate: (c) => { delete c.rooms.pub.picture; } },
  { rule: 'L12', level: 'error', strict: true, name: 'room without picture (strict)', mutate: (c) => { delete c.rooms.pub.picture; } },
  { rule: 'L12', level: 'warning', name: 'picture art missing', mutate: (c) => { delete c.art.pub; } },
  // L13
  { rule: 'L13', level: 'error', name: 'indistinguishable portable items', mutate: (c) => {
    c.items.spare_key = { name: 'brass key', names: ['key'], adjectives: ['brass'], desc: 'Another brass key.', location: 'pub' };
  } },
  { rule: 'L13', level: 'error', name: 'indistinguishable scenery and fixed item in one room', mutate: (c) => {
    c.items.statue = { name: 'fountain', names: ['fountain'], adjectives: ['dry', 'stone'], fixed: true, desc: 'A fountain.', location: 'square' };
  } },
  // L14
  { rule: 'L14', level: 'warning', name: 'declared stub (incremental)', mutate: () => {} },
  { rule: 'L14', level: 'error', strict: true, name: 'declared stub (strict)', mutate: () => {} },
  { rule: 'L14', level: 'error', name: 'stub used as an item location', mutate: (c) => { c.items.brass_key.location = 'towpath'; } },
  // L15
  { rule: 'L15', level: 'error', name: 'hook referenced but not defined', mutate: (c) => { c.rooms.pub.desc = { hook: 'pub_text' }; } },
  { rule: 'L15', level: 'warning', name: 'hook defined but never referenced', mutate: (c) => { c.hooks.unused = () => true; } },
  // L16
  { rule: 'L16', level: 'error', name: 'room zone unknown', mutate: (c) => { c.rooms.pub.zone = 'docks'; } },
  { rule: 'L16', level: 'error', name: 'panic zone without safe room', mutate: (c) => { delete c.zones.town.safeRoom; } },
  { rule: 'L16', level: 'error', name: 'safe room is dark', mutate: (c) => { c.rooms.square.dark = true; } },
  { rule: 'L16', level: 'error', name: 'safe room has a hazard', mutate: (c) => { c.hazards.canal.room = 'square'; } },
  { rule: 'L16', level: 'error', name: 'safe room in another zone', mutate: (c) => { c.zones.town.safeRoom = 'cellar'; } },
  // L17
  { rule: 'L17', level: 'error', name: 'award points do not sum to maxScore', mutate: (c) => { c.scoring.maxScore = 45; c.scoring.ranks[2].min = 45; } },
  { rule: 'L17', level: 'error', name: 'first rank not 0', mutate: (c) => { c.scoring.ranks[0].min = 5; } },
  { rule: 'L17', level: 'error', name: 'ranks not ascending', mutate: (c) => { c.scoring.ranks[1].min = 45; } },
  { rule: 'L17', level: 'warning', name: 'award never referenced', mutate: (c) => {
    c.scoring.awards.bonus = { points: 5, label: 'Bonus' }; c.scoring.maxScore = 45; c.scoring.ranks[2].min = 45;
  } },
  // L18
  { rule: 'L18', level: 'error', name: 'personal item not on the player', mutate: (c) => { c.items.warrant_card.location = 'square'; } },
  { rule: 'L18', level: 'error', name: 'personal item accepted by an NPC', mutate: (c) => { c.npcs.maggie.accepts.warrant_card = 'Ta.'; } },
  { rule: 'L18', level: 'error', name: 'critical item edible', mutate: (c) => { c.items.torch.edible = 'Crunchy.'; } },
  { rule: 'L18', level: 'error', name: 'critical light runs out before midnight', mutate: (c) => { c.items.torch.light.fuel = 100; } },
  { rule: 'L18', level: 'warning', name: 'reaction destroys a critical item', mutate: (c) => { c.npcs.maggie.talk = { say: 'Gimme.', move: { torch: null } }; } },
  // L19
  { rule: 'L19', level: 'error', name: 'duplicate ending id', mutate: (c) => { c.endings.push({ id: 'victory', kind: 'victory', title: 'Again', text: 'Again.' }); } },
  { rule: 'L19', level: 'error', name: 'no midnight catch-all last', mutate: (c) => { c.endings[1].when = { turnGte: 250 }; } },
  { rule: 'L19', level: 'warning', name: 'unreachable ending', mutate: (c) => { c.endings.push({ id: 'lost', kind: 'death', title: 'Lost', text: 'Lost.' }); } },
  // L20
  { rule: 'L20', level: 'error', name: 'beat without trigger', mutate: (c) => { c.beats.push({ id: 'never', run: 'Never.' }); } },
  { rule: 'L20', level: 'error', name: 'beat at 0', mutate: (c) => { c.beats[0].at = 0; } },
  { rule: 'L20', level: 'error', name: 'schedule after midnight', mutate: (c) => { c.npcs.pike.schedule[0].at = 301; } },
  // L21
  { rule: 'L21', level: 'warning', name: 'noun equal to a direction', mutate: (c) => { c.items.brass_key.names.push('north'); } },
  { rule: 'L21', level: 'warning', name: 'adjective equal to a filler', mutate: (c) => { c.items.iron_key.adjectives.push('the'); } },
  // L22
  { rule: 'L22', level: 'warning', name: 'flag tested but never set', mutate: (c) => { c.rooms.pub.exits.s = { to: 'square', if: '!bar_closed' }; } },
  // L23
  { rule: 'L23', level: 'error', name: 'hint with no tiers', mutate: (c) => { c.hints[0].tiers = []; } },
  { rule: 'L23', level: 'error', name: 'hint without done', mutate: (c) => { delete c.hints[1].done; } },
];
