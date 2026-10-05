// TT-009 — NPC family (ARCHITECTURE A4.8 NPCs, A4.9 topics, A8.7 GIVE protection, A8.9
// money and BUY) and self-reference (ME / MYSELF) on the mini-world and the case-world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../src/engine/types.js';
import { messages as npcMsg } from '../../src/engine/actions/npc.js';
import { messages as objMsg } from '../../src/engine/actions/objects.js';
import { createGame } from '../../src/engine/game.js';
import mini from '../fixtures/mini-world.js';
import caseWorld from '../fixtures/case-world.js';
import { lintContent } from '../../tools/lint-content.js';
import {
  newGame, cloneContent, texts, setup, last,
} from '../fixtures/harness.js';

const at = (g, roomId, extra = () => {}) => setup(g, (s) => {
  s.roomId = roomId;
  if (!s.visited.includes(roomId)) s.visited.push(roomId);
  extra(s);
});
const snap = (g) => g.snapshot();
const loc = (g, id) => snap(g).items[id].loc;
/** Texts of one input line. */
const say = (g, line) => texts(g.input(line));
/** A strict game on a modified copy of `base`. */
const variant = (base, mutate) => {
  const c = cloneContent(base);
  mutate(c);
  return newGame(c);
};

test('case-world fixture lints with zero errors (only the declared stub warns)', () => {
  const r = lintContent(caseWorld);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map((w) => w.rule), ['L14']);
});

/* ------------------------------------------------------------------------ *
 *  TALK                                                                     *
 * ------------------------------------------------------------------------ */

test('TALK TO: `talk` reaction; else `default`; else talkNothing; 1 turn each', () => {
  const g = newGame(caseWorld);
  at(g, 'office');
  assert.deepEqual(say(g, 'talk to pike'), ['"The yard gate? I\'ll unbolt it for you."']);
  assert.equal(snap(g).flags.gate_unbolted, true, 'talk reaction effects apply');
  at(g, 'alley');
  assert.deepEqual(say(g, 'speak to silas'), ['"Eh? Speak up."'], 'no talk: falls back to default');
  at(g, 'square');
  assert.deepEqual(say(g, 'talk to constable'), ['The constable has nothing to say to you.']);
  assert.equal(snap(g).turn, 3);
});

test('TALK TO a thing or to yourself is refused in-world (1 turn)', () => {
  const g = newGame(caseWorld);
  at(g, 'square');
  assert.deepEqual(say(g, 'talk to photograph'), ['You can\'t talk to the photograph.']);
  assert.deepEqual(say(g, 'talk to fountain'), ['You can\'t talk to the fountain.']);
  assert.deepEqual(say(g, 'talk to me'), [npcMsg.talkSelf]);
  assert.equal(snap(g).turn, 3);
});

test('TALK falls back to talkNothing when a conditional talk reaction does not fire', () => {
  const g = variant(mini, (c) => { c.npcs.maggie.talk = { if: 'never_set', say: 'x' }; delete c.npcs.maggie.default; });
  at(g, 'pub');
  assert.deepEqual(say(g, 'talk to maggie'), ['Maggie has nothing to say to you.'], 'proper NPC: no article');
});

/* ------------------------------------------------------------------------ *
 *  ASK / TELL                                                               *
 * ------------------------------------------------------------------------ */

test('ASK X ABOUT Y: topic keyword (multiword), item-id topic, unmatched → default', () => {
  const g = newGame();
  at(g, 'pub');
  assert.deepEqual(say(g, 'ask maggie about the dead girl'), ['"Terrible business. Ask Arthur, he knows everyone."']);
  assert.equal(snap(g).flags.heard_of_whisky, true);
  assert.deepEqual(say(g, 'ask maggie about pike'), ['"Arthur? Salt of the earth. Counts his change twice, mind."'], 'NPC id as topic');
  assert.deepEqual(say(g, 'ask landlady about the torn ledger'), ['"Never seen it before, love."'], 'item id as topic');
  assert.deepEqual(say(g, 'ask maggie about the weather tomorrow'), ['"Can\'t help you there, love."'], 'unknown topic words never error');
  assert.equal(snap(g).turn, 4);
});

test('TELL X ABOUT Y uses the same topic table; no default → topicNothing', () => {
  const g = newGame(caseWorld);
  at(g, 'office');
  assert.deepEqual(say(g, 'tell pike about maggie'), ['"Maggie? She hears everything."']);
  at(g, 'square');
  assert.deepEqual(say(g, 'ask constable about murder'), ['The constable has nothing to say about that.']);
  assert.deepEqual(say(g, 'inform bobby about the killing'), ['The constable has nothing to say about that.']);
});

test('ASK: a topic reaction that does not fire falls back to default; ASK yourself / a thing refused', () => {
  const g = variant(mini, (c) => { c.npcs.maggie.topics.pike = { if: 'never_set', say: 'x' }; });
  at(g, 'pub');
  assert.deepEqual(say(g, 'ask maggie about pike'), ['"Can\'t help you there, love."']);
  assert.deepEqual(say(g, 'ask me about pike'), [npcMsg.talkSelf]);
  assert.deepEqual(say(g, 'ask candle about pike'), ['You can\'t talk to the candle.']);
});

test('ASK sets HER / HIM: "ask her about murder" after TALK TO MAGGIE', () => {
  const g = newGame();
  at(g, 'pub');
  g.input('talk to maggie');
  assert.deepEqual(say(g, 'ask her about murder'), ['"Terrible business. Ask Arthur, he knows everyone."']);
});

/* ------------------------------------------------------------------------ *
 *  SHOW                                                                     *
 * ------------------------------------------------------------------------ */

test('SHOW X TO Y: `shows` cases, default, both word orders, personal items allowed', () => {
  const g = newGame();
  at(g, 'pub');
  assert.deepEqual(say(g, 'show card to maggie'), ['"Oh! Police, is it?"']);
  assert.deepEqual(say(g, 'show maggie the warrant card'), ['"Yes, love, I\'ve seen it."']);
  g.input('take candle');
  assert.deepEqual(say(g, 'show candle to maggie'), ['Maggie glances at it, unimpressed.']);
  assert.equal(loc(g, 'candle'), 'player', 'SHOW never moves the item');
});

test('SHOW: not holding; to a thing; to yourself (harmless); yourself to someone', () => {
  const g = newGame();
  at(g, 'pub');
  assert.deepEqual(say(g, 'show candle to maggie'), [objMsg.notHolding]);
  assert.deepEqual(say(g, 'show card to candle'), [npcMsg.showNotNpc]);
  assert.deepEqual(say(g, 'show card to me'), ['You look at the warrant card again. Nothing new strikes you.']);
  assert.deepEqual(say(g, 'show me the card'), ['You look at the warrant card again. Nothing new strikes you.']);
  assert.deepEqual(say(g, 'show me to maggie'), [npcMsg.selfDefault]);
  assert.equal(snap(g).turn, 5);
});

test('SHOW runs the NPC iobj before / after slots (A7.5), after only on success', () => {
  const g = variant(mini, (c) => { c.npcs.maggie.after = { show: 'She sniffs.' }; });
  at(g, 'pub');
  assert.deepEqual(say(g, 'show card to maggie'), ['"Oh! Police, is it?"', 'She sniffs.']);
  assert.deepEqual(say(g, 'show candle to maggie'), [objMsg.notHolding], 'failed show: no after slot');
});

/* ------------------------------------------------------------------------ *
 *  GIVE (A4.8 accepts / refuse, A8.7 protection)                            *
 * ------------------------------------------------------------------------ */

test('GIVE with an `accepts` entry: the item moves to the NPC, then the reaction', () => {
  const g = newGame();
  at(g, 'pub', (s) => { s.items.coin.loc = 'player'; s.items.coin.hidden = false; });
  assert.deepEqual(say(g, 'give coin to maggie'), ['"Ta, love."']);
  assert.equal(loc(g, 'coin'), 'maggie');
  assert.deepEqual(say(g, 'take coin'), [MESSAGES.notHere], 'items held by NPCs are out of scope');
});

test('GIVE IOBJ DOBJ word order; refuse reaction; default giveRefuse; item kept', () => {
  const g = newGame(caseWorld);
  at(g, 'pub', (s) => { s.items.helmet.loc = 'player'; });
  assert.deepEqual(say(g, 'give maggie the helmet'), ['"I don\'t want that."']);
  assert.equal(loc(g, 'helmet'), 'player');
  at(g, 'square');
  assert.deepEqual(say(g, 'offer helmet to constable'), ['The constable doesn\'t want it.']);
  assert.equal(loc(g, 'helmet'), 'player');
});

test('GIVE: critical items to the wrong NPC refused (criticalMsg or critical), to the right NPC allowed', () => {
  const g = newGame(caseWorld);
  at(g, 'square', (s) => { s.items.handcuffs.loc = 'player'; });
  g.input('take photo');
  assert.deepEqual(say(g, 'give photo to constable'), ['That photograph is the only one of Harrow you have.']);
  assert.deepEqual(say(g, 'give cuffs to constable'), [MESSAGES.critical]);
  assert.equal(loc(g, 'photo'), 'player');
  at(g, 'alley');
  assert.deepEqual(say(g, 'give photo to silas'), ['"That\'s him. That\'s the copper."']);
  assert.equal(loc(g, 'photo'), 'silas');
  assert.equal(snap(g).flags.silas_saw_photo, true);
});

test('GIVE: personal items are part of you; not holding; to a thing; to yourself', () => {
  const g = newGame();
  at(g, 'pub');
  assert.deepEqual(say(g, 'give card to maggie'), [MESSAGES.personal]);
  assert.equal(loc(g, 'warrant_card'), 'player');
  assert.deepEqual(say(g, 'give candle to maggie'), [objMsg.notHolding]);
  g.input('take candle');
  assert.deepEqual(say(g, 'give candle to bar'), [npcMsg.giveNotNpc]);
  assert.deepEqual(say(g, 'give candle to me'), ['You already have the candle.']);
  assert.deepEqual(say(g, 'give me to maggie'), [npcMsg.selfDefault]);
  assert.equal(loc(g, 'candle'), 'player');
});

test('protection and NPC messages are overridable through content.messages', () => {
  const g = variant(caseWorld, (c) => {
    c.messages = { ...c.messages, personal: 'Not a chance.', critical: 'You need that.', giveRefuse: '{The} shakes his head.' };
  });
  at(g, 'square', (s) => { s.items.handcuffs.loc = 'player'; s.items.helmet.loc = 'player'; });
  assert.deepEqual(say(g, 'give card to constable'), ['Not a chance.']);
  assert.deepEqual(say(g, 'give cuffs to constable'), ['You need that.']);
  assert.deepEqual(say(g, 'drop card'), ['Not a chance.']);
  assert.deepEqual(say(g, 'throw cuffs'), ['You need that.']);
  assert.deepEqual(say(g, 'give helmet to constable'), ['The constable shakes his head.']);
});

test('GIVE after slots run only when the NPC accepted the item', () => {
  const g = variant(mini, (c) => { c.npcs.maggie.after = { give: 'She pockets it.' }; });
  at(g, 'pub', (s) => { s.items.coin.loc = 'player'; s.items.coin.hidden = false; s.items.helmet.loc = 'player'; });
  assert.deepEqual(say(g, 'give helmet to maggie'), ['"I don\'t want that."']);
  assert.deepEqual(say(g, 'give coin to maggie'), ['"Ta, love."', 'She pockets it.']);
});

/* ------------------------------------------------------------------------ *
 *  BUY (A8.9)                                                               *
 * ------------------------------------------------------------------------ */

test('BUY: `if` false → refuse text; then success: money, item carried, default text, 1 turn', () => {
  const g = newGame();
  at(g, 'pub');
  assert.deepEqual(say(g, 'buy whisky'), ['"What would you want with that?"']);
  assert.equal(snap(g).money, 500);
  g.input('ask maggie about murder');
  assert.deepEqual(say(g, 'buy the whisky'), ['You buy a bottle of whisky for £2.00.']);
  assert.equal(snap(g).money, 300);
  assert.equal(loc(g, 'whisky'), 'player');
  assert.equal(snap(g).turn, 3);
  assert.deepEqual(say(g, 'i').slice(-1), ['You have £3.00.']);
});

test('BUY: already got one; consumed → can buy again; cannot afford', () => {
  const g = newGame();
  at(g, 'pub', (s) => { s.flags.heard_of_whisky = true; });
  g.input('buy whisky');
  assert.deepEqual(say(g, 'purchase whisky'), [npcMsg.buyHaveOne]);
  g.input('drink whisky');
  assert.equal(loc(g, 'whisky'), null);
  assert.deepEqual(say(g, 'buy whisky'), ['You buy a bottle of whisky for £2.00.']);
  g.input('drink whisky');
  assert.deepEqual(say(g, 'buy whisky'), [npcMsg.cantAfford], '100p left');
  assert.equal(snap(g).money, 100);
  assert.equal(loc(g, 'whisky'), null);
});

test('BUY: nothing for sale; BUY X FROM Y (seller, non-seller, a thing); default refuse text', () => {
  const g = variant(caseWorld, (c) => { delete c.npcs.maggie.sells.whisky.refuse; });
  at(g, 'pub');
  assert.deepEqual(say(g, 'buy candle'), [npcMsg.buyNoSale], 'visible but not sold');
  assert.deepEqual(say(g, 'buy whisky'), ['Maggie won\'t sell you that.']);
  at(g, 'alley');
  assert.deepEqual(say(g, 'buy matches from silas'), ['Silas sells you a box of matches.'], 'content text');
  assert.equal(snap(g).money, 470);
  assert.deepEqual(say(g, 'buy key from silas'), ['Silas doesn\'t sell that.']);
  assert.deepEqual(say(g, 'buy matches from key'), [npcMsg.buyNoSale]);
  assert.deepEqual(say(g, 'buy me'), [npcMsg.buyNoSale]);
});

test('BUY formats pence under £1 as "50p" and triggers evidence discovery (A8.8)', () => {
  const g = variant(mini, (c) => {
    c.npcs.maggie.sells.whisky = { price: 50 };
    c.evidence.ev_whisky = { label: 'A bottle of whisky', item: 'whisky', award: 'register' };
  });
  at(g, 'pub');
  const ev = g.input('buy whisky');
  assert.deepEqual(texts(ev), ['You buy a bottle of whisky for 50p.', '[Your score has gone up by 5 points.]']);
  assert.deepEqual(snap(g).evidence, ['ev_whisky']);
});

test('BUY out of scope: an unsold, unseen item is not here; AGAIN repeats a purchase attempt', () => {
  const g = newGame();
  at(g, 'office');
  assert.deepEqual(say(g, 'buy whisky'), [MESSAGES.notHere]);
  at(g, 'pub', (s) => { s.flags.heard_of_whisky = true; });
  g.input('buy whisky');
  assert.deepEqual(say(g, 'again'), [npcMsg.buyHaveOne]);
});

/* ------------------------------------------------------------------------ *
 *  Self-reference (ME / MYSELF / SELF / YOURSELF)                           *
 * ------------------------------------------------------------------------ */

test('EXAMINE ME / MYSELF / SELF / YOURSELF: default self description, 1 turn, works in the dark', () => {
  const g = newGame();
  for (const w of ['me', 'myself', 'self', 'yourself']) assert.deepEqual(say(g, `x ${w}`), [npcMsg.examineSelf]);
  assert.equal(npcMsg.examineSelf, 'As good as can be expected, given the night.');
  assert.equal(snap(g).turn, 4);
  at(g, 'cellar');
  assert.deepEqual(say(g, 'examine me'), [npcMsg.examineSelf]);
});

test('EXAMINE ME is content-overridable; other verbs on yourself are harmless refusals', () => {
  const g = variant(mini, (c) => { c.messages = { ...c.messages, examineSelf: 'Wet through, {money} in your pocket.' }; });
  assert.deepEqual(say(g, 'examine me'), ['Wet through, £5.00 in your pocket.']);
  for (const line of ['take me', 'attack myself', 'push me', 'drop me', 'eat me', 'open me', 'search me']) {
    assert.deepEqual(say(g, line), [npcMsg.selfDefault], line);
  }
  assert.deepEqual(say(g, 'accuse me'), ['You would have some explaining to do at the station.']);
});

test('self-reference: no pronoun change, AGAIN repeats it, and SAVE / LOAD keeps the command', () => {
  const g = newGame();
  at(g, 'office');
  g.input('x torch');
  g.input('x me');
  assert.equal(snap(g).ctx.it, 'torch', 'ME never becomes IT');
  assert.deepEqual(say(g, 'g'), [npcMsg.examineSelf]);
  const data = g.save();
  assert.equal(data.state.ctx.lastCommand.dobj, 'player');
  const g2 = newGame();
  assert.equal(g2.load(data).ok, true);
  assert.deepEqual(texts(g2.input('again')), [npcMsg.examineSelf]);
});

test('self words are known: no unknown-word errors; ME in a list is not an object', () => {
  const g = newGame();
  for (const w of ['me', 'myself', 'self', 'yourself']) {
    assert.ok(!say(g, `take ${w}`)[0].startsWith('I don\'t know'), w);
  }
  at(g, 'office');
  assert.deepEqual(say(g, 'take torch and me'), [MESSAGES.notHere]);
});

test('NPC verbs never throw on a fuzz of sentences (strict)', () => {
  const g = createGame({ content: cloneContent(caseWorld), seed: 7, strict: true });
  const rooms = ['square', 'pub', 'office', 'alley'];
  const verbs = ['talk to', 'ask', 'tell', 'show', 'give', 'buy', 'accuse', 'x'];
  const nouns = ['maggie', 'pike', 'silas', 'constable', 'me', 'card', 'photo', 'whisky', 'matches', 'coin', 'bar', 'it', 'her'];
  let n = 0;
  for (const room of rooms) {
    at(g, room);
    for (const v of verbs) {
      for (const a of nouns) {
        for (const tail of ['', ` to ${nouns[n % nouns.length]}`, ` about ${nouns[(n * 7) % nouns.length]}`, ` from ${nouns[(n * 3) % nouns.length]}`]) {
          n++;
          const ev = g.input(`${v} ${a}${tail}`);
          if (snap(g).ctx.pending) g.input('no');
          if (snap(g).ended) g.input('undo');
          assert.ok(Array.isArray(ev));
        }
      }
    }
  }
  assert.ok(n > 400);
  assert.equal(last(g.input('look')).type, 'status');
});
