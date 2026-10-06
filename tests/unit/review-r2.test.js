// TT-106: regression tests for the R2 presentation review (reviews/code-review-R2-1.md).
// Blocking issues 1 (typewriter clock) and 2 (title hold) are covered in terminal.test.js
// and boot.test.js; this file holds the non-blocking notes that have a pure surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalCore, keyMods, isAnyKeyPress } from '../../src/ui/terminal.js';
import { panelFor, PICTURE_ROWS } from '../../src/ui/picture.js';
import { fxMayChange, applyAllFx, cellAt, FX_ORDER } from '../../src/ui/fx.js';
import { createDispatcher } from '../../src/ui/dispatch.js';
import { lintContent } from '../../tools/lint-content.js';
import { hasGlyph } from '../../src/ui/font8x8.js';
import { freshMini } from '../fixtures/lint-bad.js';
import realContent from '../../src/content/index.js';

// ---------- note 1: held key into the ending prompt ----------

test('isAnyKeyPress: fresh printable / Enter only; no repeats, modifiers, shortcuts or F-keys', () => {
  assert.equal(isAnyKeyPress({ key: 'x' }), true);
  assert.equal(isAnyKeyPress({ key: 'Enter' }), true);
  assert.equal(isAnyKeyPress({ key: ' ' }), true);
  assert.equal(isAnyKeyPress({ key: 'x', repeat: true }), false, 'auto-repeat of a held key');
  for (const key of ['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock']) assert.equal(isAnyKeyPress({ key }), false, key);
  assert.equal(isAnyKeyPress({ key: 'r', ctrlKey: true }), false);
  assert.equal(isAnyKeyPress({ key: 'Tab', altKey: true }), false);
  assert.equal(isAnyKeyPress({ key: 'F5' }), false);
  assert.equal(isAnyKeyPress({}), false);
});

test('clearInput drops type-ahead (keys held through the ending text)', () => {
  const core = createTerminalCore();
  core.print('x'.repeat(200));
  core.tick(0);
  core.tick(16);
  core.key('x'); // skips and is kept as type-ahead
  core.key('x');
  assert.equal(core.input.text, 'xx');
  core.clearInput();
  assert.deepEqual(core.input, { text: '', cursor: 0 });
});

// ---------- note 2: ending-screen region ----------

test('ending region (rows 22-24, echoPages:false): a two-line answer needs no [MORE]', () => {
  const core = createTerminalCore({ typewriter: false });
  core.setRegion({ top: 22, bottom: 24, echoPages: false });
  let now = 0;
  const tick = () => core.tick(now += 16);
  core.print('UNDO, LOAD, RESTART or IMPORT?', 'system');
  tick();
  for (const ch of 'look') core.key(ch);
  core.key('Enter');
  core.print('The game is over. Type UNDO, LOAD, RESTART or IMPORT.'); // wraps to 2 lines
  tick();
  tick();
  assert.equal(core.more, false);
  assert.equal(core.ready, true);
  const rows = core.compose(now).rows.map((r) => r.map((c) => c.ch).join('').trimEnd());
  assert.deepEqual(rows.slice(0, 2), ['The game is over. Type UNDO, LOAD,', 'RESTART or IMPORT.']);

  // a normal region still counts the echo (a page starts with > COMMAND)
  const play = createTerminalCore({ typewriter: false });
  play.setRegion({ top: 22, bottom: 24 });
  for (const ch of 'look') play.key(ch);
  play.key('Enter');
  play.print('The game is over. Type UNDO, LOAD, RESTART or IMPORT.');
  play.tick(16);
  play.tick(32);
  assert.equal(play.more, true);

  // setGraphics restores the default
  core.setGraphics(true);
  for (const ch of 'x') core.key(ch);
  core.key('Enter');
  core.print(Array.from({ length: 13 }, (_, i) => `line ${i}`).join('\n'));
  tick(); tick();
  assert.equal(core.more, true, 'echo + 13 lines on 13 rows pages again');
});

// ---------- note 3: picture id:null blanks, graphics:false hides ----------

test('panelFor: id:null with graphics on keeps a blank panel; graphics:false hides it', () => {
  const art = { mill: { h: PICTURE_ROWS }, title: { h: 25 } };
  assert.deepEqual(panelFor({ id: 'mill', graphics: true }, art), { shown: true, def: art.mill });
  assert.deepEqual(panelFor({ id: null, graphics: true }, art), { shown: true, def: null });
  assert.deepEqual(panelFor({ id: 'nope', graphics: true }, art), { shown: true, def: null }, 'missing art: blank, no jump');
  assert.deepEqual(panelFor({ id: 'title', graphics: true }, art), { shown: true, def: null }, 'not a 40x9 picture');
  assert.deepEqual(panelFor({ id: 'mill', graphics: false }, art), { shown: false, def: null });
});

// ---------- note 4: ending art fx vs reserved rows ----------

test('fxMayChange is sound: every fx override lands on a cell it predicts', () => {
  const arts = Object.values(realContent.art).filter((a) => Array.isArray(a.fx) && a.fx.length);
  assert.ok(arts.length > 5);
  for (const a of arts) {
    for (let t = 0; t < 200; t += 1) {
      for (const o of applyAllFx(a, t, 0)) {
        const base = cellAt(a, o.x, o.y);
        assert.ok(a.fx.some((f) => fxMayChange(f, base)), `${a.id} tick ${t}: (${o.x},${o.y}) ${JSON.stringify(base)} changed`);
      }
    }
  }
  assert.deepEqual(FX_ORDER.filter((f) => fxMayChange(f, { ch: ' ', fg: '1', bg: '0' })).sort(), ['fog', 'flicker', 'lightning', 'rain'].sort());
  assert.equal(FX_ORDER.some((f) => fxMayChange(f, { ch: '▓', fg: '0', bg: '0' })), false, 'the inert reserved-row cell');
});

/** A 40x25 ending art: '▓' everywhere (fx-inert), with optional overrides. */
function endArt(fx, patch = () => {}) {
  const chars = Array.from({ length: 25 }, () => '▓'.repeat(40));
  const colors = Array.from({ length: 25 }, () => '0'.repeat(40));
  const a = { id: 'end_test', w: 40, h: 25, chars, colors, fx };
  patch(a);
  return a;
}

test('lint L24: an ending art whose fx can touch rows 19-24 is an error', () => {
  const lint = (c) => lintContent(c, { hasGlyph });
  const withArt = (a) => {
    const c = freshMini();
    c.art.end_test = a;
    c.endings.find((e) => e.id === 'death_fall').art = 'end_test';
    return c;
  };
  const l11 = (r) => r.errors.filter((e) => e.rule === 'L24');
  assert.deepEqual(l11(lint(withArt(endArt(['rain'])))), [], 'all reserved cells inert');

  const rainHole = endArt(['rain'], (a) => { a.chars[20] = `${'▓'.repeat(5)} ${'▓'.repeat(34)}`; });
  const r = l11(lint(withArt(rainHole)));
  assert.equal(r.length, 1, JSON.stringify(r));
  assert.match(r[0].path, /art\.end_test\.chars\[20\]/);
  assert.match(r[0].message, /rain/);

  const flicker = endArt(['flicker'], (a) => { a.colors[24] = `${'0'.repeat(39)}7`; });
  assert.equal(l11(lint(withArt(flicker))).length, 1, 'flicker would dim a bright cell on row 24');

  const above = endArt(['rain'], (a) => { a.chars[18] = ' '.repeat(40); });
  assert.deepEqual(l11(lint(withArt(above))), [], 'rows 0-18 may animate');
  assert.deepEqual(l11(lint(withArt(endArt([], (a) => { a.chars[22] = ' '.repeat(40); })))), [], 'no fx, no rule');
});

// ---------- note 5: F2 during the boot ----------

test('dispatcher.setting(…, {ack:false}) persists and applies without printing an ack', () => {
  const printed = [];
  const applied = [];
  const writes = [];
  const marks = [];
  const d = createDispatcher({
    print: (t) => printed.push(t),
    mark: (fn) => marks.push(fn),
    applySetting: (k, v) => applied.push(`${k}=${v}`),
    adapter: { writeSetting: (k, v) => writes.push(`${k}=${v}`) },
  }, { settings: { sound: 'on' } });
  const r = d.setting('sound', 'toggle', { ack: false });
  assert.equal(r.value, 'off');
  assert.deepEqual(writes, ['sound=off']);
  marks.forEach((fn) => fn());
  assert.deepEqual(applied, ['sound=off']);
  assert.deepEqual(printed, []);
  d.setting('sound', 'toggle');
  assert.equal(printed.length, 1, 'the default still acknowledges');
});

// ---------- note 7: AltGr ----------

test('keyMods: AltGr characters are text, Ctrl/Alt shortcuts stay shortcuts', () => {
  const ev = (key, mods = {}, altGraph = false) => ({ key, ...mods, getModifierState: (k) => k === 'AltGraph' && altGraph });
  assert.deepEqual(keyMods(ev('@', { ctrlKey: true, altKey: true }, true)), { ctrl: false, alt: false, meta: false });
  assert.deepEqual(keyMods(ev('£', { ctrlKey: true, altKey: true })), { ctrl: false, alt: false, meta: false }, 'Windows reports AltGr as Ctrl+Alt');
  assert.deepEqual(keyMods(ev('t', { ctrlKey: true, altKey: true })), { ctrl: true, alt: true, meta: false }, 'Ctrl+Alt+letter is a shortcut');
  assert.deepEqual(keyMods(ev('r', { ctrlKey: true })), { ctrl: true, alt: false, meta: false });
  assert.deepEqual(keyMods(ev('ArrowLeft', { altKey: true })), { ctrl: false, alt: true, meta: false });
  assert.deepEqual(keyMods({ key: 'a' }), { ctrl: false, alt: false, meta: false }, 'no getModifierState');

  const core = createTerminalCore({ typewriter: false });
  assert.equal(core.key('@', keyMods(ev('@', { ctrlKey: true, altKey: true }, true))), true);
  assert.equal(core.input.text, '@');
});
