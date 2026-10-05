// TT-008 — light family (ARCHITECTURE A8.2, A9.2 O5 lighting change) on the mini-world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../../src/engine/types.js';
import { messages as lightMsgs } from '../../src/engine/actions/light.js';
import mini from '../fixtures/mini-world.js';
import {
  newGame, cloneContent, texts, types, setup,
} from '../fixtures/harness.js';

const inCellarWithTorch = (g) => setup(g, (s) => {
  s.roomId = 'cellar'; s.prevRoomId = 'alley'; s.visited.push('alley', 'cellar'); s.items.torch.loc = 'player';
});

test('TURN ON / LIGHT / SWITCH ON and TURN OFF a light source', () => {
  const g = newGame();
  setup(g, (s) => { s.items.torch.loc = 'player'; s.items.candle.loc = 'player'; });
  assert.deepEqual(texts(g.input('turn on torch')), ['The torch is now on.', '[Your score has gone up by 5 points.]']);
  assert.equal(g.snapshot().items.torch.lit, true);
  assert.deepEqual(texts(g.input('switch torch on')), ['The torch is already on.']);
  assert.deepEqual(texts(g.input('light candle')), ['The candle is now on.']);
  assert.deepEqual(texts(g.input('turn off torch')), ['The torch is now off.']);
  assert.deepEqual(texts(g.input('extinguish torch')), ['The torch is already off.']);
  assert.deepEqual(texts(g.input('turn on torch')), ['The torch is now on.'], 'award is once-only');
});

test('things that are not lights', () => {
  const g = newGame();
  setup(g, (s) => { s.items.helmet.loc = 'player'; });
  assert.deepEqual(texts(g.input('light helmet')), [lightMsgs.notSwitchable]);
  assert.deepEqual(texts(g.input('turn off helmet')), [lightMsgs.notSwitchableOff]);
});

test('light.needs gates switching on; needsMsg or the default refusal', () => {
  const content = cloneContent(mini);
  content.items.torch = { ...content.items.torch, light: { lit: false, needs: 'fresh_batteries', needsMsg: 'Nothing. The batteries are dead.' } };
  content.items.candle = { ...content.items.candle, light: { ...content.items.candle.light, needs: 'have_matches' } };
  const g = newGame(content);
  setup(g, (s) => { s.items.torch.loc = 'player'; s.items.candle.loc = 'player'; });
  assert.deepEqual(texts(g.input('turn on torch')), ['Nothing. The batteries are dead.']);
  assert.deepEqual(texts(g.input('light candle')), [lightMsgs.lightNeeds]);
  setup(g, (s) => { s.flags.fresh_batteries = true; });
  assert.equal(texts(g.input('turn on torch'))[0], 'The torch is now on.');
});

test('a spent light (fuel 0) cannot be lit', () => {
  const g = newGame();
  setup(g, (s) => { s.items.candle.loc = 'player'; s.items.candle.fuel = 0; });
  assert.deepEqual(texts(g.input('light candle')), ['The candle is spent.']);
});

test('lighting change in place (O5): picture + full description when lit, darkness text when unlit', () => {
  const g = newGame();
  inCellarWithTorch(g);
  const on = g.input('turn on torch');
  assert.deepEqual(types(on), ['text', 'text', 'picture', 'text', 'text', 'text', 'text', 'status']);
  assert.deepEqual(on[2], { type: 'picture', id: 'cellar', graphics: true });
  assert.deepEqual(texts(on).slice(2), ['Cellar', 'Damp brick vaults. Somewhere, water drips.', 'You can see an iron key here.', 'Exits: up.']);
  const off = g.input('turn off torch');
  assert.deepEqual(off.slice(0, 3), [
    { type: 'text', text: 'The torch is now off.' },
    { type: 'picture', id: null, graphics: true },
    { type: 'text', text: MESSAGES.dark },
  ]);
});

test('no re-description when the room stays lit, or when the player moved', () => {
  const g = newGame();
  setup(g, (s) => { s.items.torch.loc = 'player'; });
  assert.ok(!types(g.input('turn on torch')).includes('picture'));
  g.input('s');
  const ev = g.input('d');
  assert.equal(ev.filter((e) => e.type === 'picture').length, 1, 'only the room-entry picture');
});

test('in the dark, carried lights can still be switched on by touch', () => {
  const g = newGame();
  inCellarWithTorch(g);
  assert.equal(texts(g.input('turn on torch'))[0], 'The torch is now on.');
});

test('a light inside a closed container cannot be reached', () => {
  const g = newGame();
  setup(g, (s) => { s.items.torch.loc = 'satchel'; s.roomId = 'office'; s.visited.push('office'); });
  assert.deepEqual(texts(g.input('open satchel. close satchel. turn on torch')).slice(-1), [MESSAGES.notHere]);
  const content = cloneContent(mini);
  content.items.satchel = { ...content.items.satchel, container: { capacity: 3, transparent: true } };
  const g2 = newGame(content);
  setup(g2, (s) => { s.items.torch.loc = 'satchel'; s.roomId = 'office'; s.visited.push('office'); });
  assert.deepEqual(texts(g2.input('turn on torch')), ['You can\'t reach it.']);
});
