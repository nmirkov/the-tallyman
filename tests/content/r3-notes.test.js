// TT-105 — regressions for the R3 content review notes (reviews/code-review-R3-1.md).
// Note 1 (dark re-entry after a TURN OFF refusal) lives in tests/walkthrough/solvability.test.js
// next to the other TT-120..122 darkness tests. Expected texts are STORY's (§4, §5.2, §7.4, §8.4).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import content from '../../src/content/index.js';
import { setup } from '../fixtures/harness.js';
import { fresh, feed, joined, snap, WALKTHROUGH, assertRunning } from '../walkthrough/script.js';

const say = (g, line) => joined(g.input(line));
const NOT_RESOLVED = /You can't see any such thing\.|I don't know the word/;

/** A fresh game with the player in `room`, a lit torch in hand, plus `extra` state edits. */
function placed(room, extra = () => {}) {
  const g = fresh();
  setup(g, (s) => {
    s.roomId = room;
    if (!s.visited.includes(room)) s.visited.push(room);
    s.items.torch.loc = 'player';
    s.items.torch.moved = true;
    s.items.torch.lit = true;
    s.flags.torch_loaded = true;
    extra(s);
  });
  return g;
}

/* ------------------------------------------------------------------------ *
 *  Notes 3-5, 13b: every noun of every room description resolves there      *
 * ------------------------------------------------------------------------ */

/**
 * Words of a room's prose that are NOT examinable nouns in that room, by design (STORY §0:
 * neighbouring rooms used as directions; plus adjectives, numbers, verbs and smells).
 * Keep this list short: a new desc noun belongs in the room's scenery, not here.
 */
const NOT_NOUNS_HERE = {
  platform: ['last', 'lamps', 'room', 'town'],
  waiting_room: ['room', 'back'],
  station_road: ['rain', 'market', 'canal'],
  market_square: ['square', 'stone', 'high'],
  phone_box: ['box', 'ends', '10p', 'four', 'square'],
  black_lamb: ['mild', 'market', 'square'],
  harrows_room: ['room', 'rain'],
  police_house: ['cells', 'square'],
  cells: ['four'],
  high_street: ['high', 'square'],
  chapel_street: ['high'],
  number_13: ['room', 'ten', 'four'],
  back_alley: ['ginnel', 'four'],
  church_lane: ['high'],
  st_judes: ['stone', 'line', 'lead'],
  vestry: ['church'],
  churchyard: ['men', 'porch', 'ginnel'],
  crypt: ['crypt', 'lead'],
  canal_bridge: ['lead'],
  towpath: ['bridge'],
  lock: ['ten'],
  lock_cottage: ['cottage'],
  shed: ['shed'],
  moor_road: ['moor'],
  harrows_car: ['cortina', 'embassy', 'dog', 'rain'],
  tally_stone: ['moor', 'town', 'quarry'],
  quarry_edge: ['stone'],
  quarry_hut: ['tin', 'hut', 'quarry', 'edge'],
  quarry_floor: ['floor', 'back'],
  mill_gates: ['iron', 'high'],
  mill_yard: ['mill', 'shed', 'lead', 'boiler', 'room', 'gates'],
  weaving_shed: ['shed'],
  boiler_room: ['room', 'lead', 'fire'],
  asylum_gates: ['asylum', 'moor'],
  coal_chute: ['cellar', 'light', 'building', 'back'],
  ward: ['gates'],
  morgue: ['back', 'iron', 'drop', 'square'],
  counting_room: ['room', 'four'],
};

/** Every word that names a thing somewhere in the game (scenery and item nouns). People are
 * left out: whether an NPC is in the room is state, and "Pike's bicycle" names the bicycle. */
const NOUNS = (() => {
  const set = new Set();
  const add = (names) => { for (const n of names ?? []) for (const w of n.split(' ')) set.add(w); };
  for (const r of Object.values(content.rooms)) for (const sc of r.scenery ?? []) add(sc.names);
  for (const it of Object.values(content.items)) add(it.names);
  for (const npc of Object.values(content.npcs)) for (const n of npc.names) for (const w of n.split(' ')) set.delete(w);
  return set;
})();

const descWords = (room) => {
  const variants = Array.isArray(room.desc) ? room.desc.map((v) => v.text) : [room.desc];
  return [...new Set(variants.join(' ').toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9 -]/g, ' ').split(/\s+/))];
};

describe('TT-105: scenery coverage (STORY §0) - every noun in a room description resolves in that room', () => {
  for (const [id, room] of Object.entries(content.rooms)) {
    test(id, () => {
      const g = placed(id);
      const skip = new Set(NOT_NOUNS_HERE[id] ?? []);
      const gaps = descWords(room).filter((w) => NOUNS.has(w) && !skip.has(w))
        .filter((w) => NOT_RESOLVED.test(say(g, `x ${w}`)));
      assert.deepEqual(gaps, []);
    });
  }

  test('the reviewer\'s list (notes 3-5) resolves, including the formerly unknown words', () => {
    const cases = {
      counting_room: ['knife', 'tunic', 'door', 'iron door', 'brick', 'vault'],
      counting_house: ['desk', 'window', 'padlock'],
      boiler_room: ['steps', 'floor'],
      crypt: ['wall', 'steps'],
      morgue: ['wall', 'floor', 'stair'],
      harrows_room: ['stair'],
      entrance_hall: ['stair', 'cellar'],
      lock_cottage: ['door'],
      moor_road: ['door'],
      mill_gates: ['bar'],
      quarry_edge: ['lip', 'edge'],
      quarry_floor: ['spoil', 'heaps', 'edge'],
      records_office: ['lodge'],
      asylum_gates: ['wall', 'padlock'],
      cells: ['corridor'],
    };
    for (const [room, words] of Object.entries(cases)) {
      const g = placed(room, (s) => { if (room === 'counting_room') { s.vars.pikeState = 'counting'; s.npcs.pike.loc = room; } });
      for (const w of words) assert.doesNotMatch(say(g, `x ${w}`), NOT_RESOLVED, `${room}: x ${w}`);
    }
  });
});

/* ------------------------------------------------------------------------ *
 *  Note 3: the Counting Room's knife, tunic and door                        *
 * ------------------------------------------------------------------------ */

describe('TT-105 note 3: the Counting Room', () => {
  test('knife, tunic and iron door; X TUNIC is the tunic even with the button in your pocket', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    assert.match(say(g, 'x tunic'), /^Pike's tunic, folded square on the wages table\. The second button down is missing\./);
    assert.match(say(g, 'x knife'), /^A butcher's knife, a foot of it, honed thin\./);
    assert.match(say(g, 'x iron door'), /^The iron door to the tunnel, standing ajar\./);
  });

  test('after the arrest the knife lies out of his reach', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 90));
    assert.match(say(g, 'x knife'), /^On the brick where it fell, well out of his reach\./);
  });
});

/* ------------------------------------------------------------------------ *
 *  Note 4: TIE (and its synonyms) at the winch post; lip / edge             *
 * ------------------------------------------------------------------------ */

describe('TT-105 note 4: "You could tie a rope to that"', () => {
  for (const line of ['tie rope to post', 'fasten rope to winch post', 'knot rope round post', 'lash rope to post', 'attach rope to post', 'tie rope', 'use rope']) {
    test(`${line} at the edge, rope in hand, is the climb down`, () => {
      const g = placed('quarry_edge', (s) => { s.items.rope.loc = 'player'; s.items.rope.moved = true; });
      const t = say(g, line);
      assert.equal(snap(g).roomId, 'quarry_floor');
      assert.equal(snap(g).flags.climbed_down, true);
      assert.match(t, /You loop the rope round the winch post and let yourself down hand over hand/);
      assertRunning(g);
    });
  }

  test('a second time it says so; without the rope in hand it is refused; elsewhere it is refused', () => {
    const g = placed('quarry_edge', (s) => { s.items.rope.loc = 'player'; s.items.rope.moved = true; });
    feed(g, ['tie rope to post', 'u']);
    assert.match(say(g, 'tie rope to post'), /^You loop the rope round the winch post again and go down it hand over hand\./);
    assert.equal(snap(g).roomId, 'quarry_floor');
    const h = placed('quarry_edge', (s) => { s.items.rope.loc = 'quarry_edge'; s.items.rope.moved = true; });
    assert.equal(say(h, 'tie rope to post'), "You'll want to be holding it first.");
    assert.equal(snap(h).roomId, 'quarry_edge');
    const k = placed('quarry_hut');
    assert.equal(say(k, 'tie rope'), "There's nothing here worth tying it to.");
    assert.equal(say(k, 'tie torch'), "You've nothing that needs tying.");
  });

  test('X LIP / X EDGE describe the face; JUMP OFF EDGE is the refusal, not an unknown word', () => {
    const g = placed('quarry_edge');
    assert.match(say(g, 'x lip'), /^Sixty feet of wet gritstone\./);
    assert.match(say(g, 'x edge'), /^Sixty feet of wet gritstone\./);
    assert.equal(say(g, 'jump off edge'), 'You look at the drop. The drop looks at you. No.');
    assertRunning(g);
  });
});

/* ------------------------------------------------------------------------ *
 *  Notes 6-7: the Police House and the cells after Pike has gone            *
 * ------------------------------------------------------------------------ */

describe('TT-105 notes 6-7: Pike\'s helmet, cape and bicycle', () => {
  test('fled, then in the Counting Room: the helmet stays on the floor, the cape and the bicycle are gone', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 64), 'z', 'z', 'z', 'z', 'z']);
    assert.equal(snap(g).vars.pikeState, 'counting');
    assert.match(say(g, 'look'), /Pike's helmet lies on the floor where it fell\./);
    assert.match(say(g, 'x helmet'), /^Pike's helmet, upturned\./);
    assert.match(say(g, 'x floor'), /Pike's helmet lies upturned where it fell\./);
    assert.match(say(g, 'x cape'), /Pike's peg is empty: his cape has gone out into the rain with him\./);
    assert.match(say(g, 'e'), /The corridor is empty: Pike's bicycle has gone/);
    assert.equal(say(g, 'x bicycle'), 'Gone. A smear of moor mud on the tiles where it leaned.');
  });

  test('left on his rounds at 23:30: cape gone, helmet on its peg, bicycle gone', () => {
    const g = placed('police_house', (s) => { s.turn = 238; });
    assert.match(say(g, 'x cape'), /Pike's cape hangs there/);
    assert.match(say(g, 'z'), /He takes his cape from the peg/);
    assert.match(say(g, 'x peg'), /Pike's peg is empty/);
    assert.equal(say(g, 'x helmet'), 'On its peg, polished.');
    assert.match(say(g, 'e'), /The corridor is empty: Pike's bicycle has gone/);
  });

  test('while he is at his desk the bicycle leans in the corridor', () => {
    const g = placed('cells');
    assert.match(say(g, 'look'), /A black police bicycle leans in the corridor\./);
    assert.match(say(g, 'x bike'), /^Pike's bicycle, upright and heavy\./);
  });
});

/* ------------------------------------------------------------------------ *
 *  Notes 8, 9, 11                                                           *
 * ------------------------------------------------------------------------ */

describe('TT-105 notes 8, 9, 11', () => {
  test('note 8: Beneath has its own nerve lines (no "find some light" with a torch in hand)', () => {
    const g = fresh();
    feed(g, WALKTHROUGH.slice(0, 89));
    setup(g, (s) => { s.nerve = 48; });
    const t = say(g, 'z');
    assert.match(t, /Your hands will not stop shaking\. The torch beam shakes with them\. Breathe\./);
    assert.doesNotMatch(t, /Find some light, somewhere warm\./);
    const town = placed('crypt', (s) => { s.nerve = 49; s.items.torch.loc = 'waiting_room'; s.items.torch.lit = false; });
    assert.match(say(town, 'z'), /Find some light, somewhere warm\./);
  });

  test('note 9: READ MAP ("S. THORNE - saw something?") is enough for Maggie to sell the whisky', () => {
    const g = fresh();
    feed(g, [...WALKTHROUGH.slice(0, 13), 'u', 'open suitcase', 'read map', 'd']);
    assert.equal(snap(g).flags.heard_of_silas, true);
    say(g, 'buy whisky');
    assert.equal(snap(g).items.whisky.loc, 'player');
  });

  test('note 11: the torch in your hand can be examined by touch in the dark', () => {
    const g = fresh();
    feed(g, ['w', 'take torch', 'e', 'n', 'n', 'w', 'show card to maggie', 'e', 'n', 'ne', 'n', 'd']);
    assert.match(say(g, 'x torch'), /^By feel: .* The dead batteries rattle when you shake it\.$/);
    g.input('put batteries in torch');
    assert.match(say(g, 'x torch'), /^By feel: .* It is switched off\. TURN it ON\.$/);
    assert.equal(say(g, 'x key'), "It's too dark to see.", 'other carried items: engine rule, TT-105 follow-up');
  });
});
