// TT-003: pure (DOM-free) parts of the screen renderer — font, palette, layout, cell buffer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { font8x8, glyphFor, hasGlyph, CURSOR, FALLBACK_CHAR } from '../../src/ui/font8x8.js';
import {
  PEPTO, COLODORE, SPECTRUM, THEMES, getTheme, resolveColor, packRGBA,
} from '../../src/ui/palette.js';
import {
  computeLayout, createCellBuffer, glyphPixels, SCREEN_COLS, SCREEN_ROWS,
} from '../../src/ui/screen.js';

const HEX = /^#[0-9a-f]{6}$/;

// ---------- font ----------

test('font: printable ASCII 0x20-0x7E all present with 8 bytes', () => {
  for (let cp = 0x20; cp <= 0x7e; cp++) {
    const g = font8x8.get(cp);
    assert.ok(g, `missing U+${cp.toString(16)}`);
    assert.equal(g.length, 8);
    for (const b of g) assert.ok(Number.isInteger(b) && b >= 0 && b <= 255);
  }
});

test('font: "A" matches the dhepper reference bytes (LSB = leftmost pixel)', () => {
  assert.deepEqual([...font8x8.get(0x41)], [0x0c, 0x1e, 0x33, 0x33, 0x3f, 0x33, 0x33, 0x00]);
});

test('font: box drawing U+2500-257F and blocks U+2580-259F are complete', () => {
  for (let cp = 0x2500; cp <= 0x259f; cp++) assert.ok(hasGlyph(String.fromCodePoint(cp)), `U+${cp.toString(16)}`);
  assert.deepEqual([...glyphFor('█')], [255, 255, 255, 255, 255, 255, 255, 255]);
});

test('font: custom £ glyph exists and is not blank', () => {
  assert.ok(hasGlyph('£'));
  assert.ok(glyphFor('£').some((b) => b !== 0));
  assert.notDeepEqual([...glyphFor('£')], [...glyphFor('?')]);
});

test('font: solid cursor glyph is a full cell', () => {
  assert.equal(typeof CURSOR, 'string');
  assert.ok(hasGlyph(CURSOR));
  assert.deepEqual([...glyphFor(CURSOR)], [255, 255, 255, 255, 255, 255, 255, 255]);
});

test('font: unknown glyphs fall back to "?"', () => {
  assert.equal(FALLBACK_CHAR, '?');
  assert.equal(hasGlyph('é'), false);
  assert.equal(hasGlyph('…'), false);
  assert.equal(hasGlyph('\n'), false);
  assert.deepEqual([...glyphFor('é')], [...glyphFor('?')]);
  assert.deepEqual([...glyphFor(0x1f600)], [...glyphFor('?')]);
});

// ---------- palette ----------

test('palette: C64 palettes have 16 valid colours with known anchors', () => {
  for (const p of [PEPTO, COLODORE]) {
    assert.equal(p.length, 16);
    for (const c of p) assert.match(c, HEX);
    assert.equal(p[0], '#000000');
    assert.equal(p[1], '#ffffff');
  }
  assert.equal(PEPTO[6], '#352879');
  assert.equal(PEPTO[14], '#6c5eb5');
});

test('palette: Spectrum has 8 normal + 8 bright colours', () => {
  assert.equal(SPECTRUM.normal.length, 8);
  assert.equal(SPECTRUM.bright.length, 8);
  for (const c of [...SPECTRUM.normal, ...SPECTRUM.bright]) assert.match(c, HEX);
  assert.equal(SPECTRUM.bright[7], '#ffffff');
  assert.equal(SPECTRUM.normal[0], '#000000');
});

test('palette: themes c64, spectrum, amber with 16 colours each', () => {
  for (const name of ['c64', 'spectrum', 'amber']) {
    const t = THEMES[name];
    assert.ok(t, name);
    assert.equal(t.colors.length, 16);
    for (const c of t.colors) assert.match(c, HEX);
  }
  const c64 = getTheme('c64');
  assert.equal(c64.roles.border, 'e');
  assert.equal(c64.roles.bg, '6');
  assert.equal(c64.roles.fg, 'e');
  assert.equal(c64.upper, true);
  const zx = getTheme('spectrum');
  assert.equal(zx.upper, false);
  assert.equal(resolveColor(zx, 'bg'), resolveColor(zx, 'border'));
  assert.equal(resolveColor(zx, 'fg'), '#000000');
  assert.ok(['#ffffff', SPECTRUM.normal[7]].includes(resolveColor(zx, 'bg')));
  assert.equal(getTheme('nope').name, 'c64');
});

test('palette: resolveColor handles keys, roles, literal hex and junk', () => {
  const t = getTheme('c64');
  assert.equal(resolveColor(t, '6'), t.colors[6]);
  assert.equal(resolveColor(t, 'E'), t.colors[14]);
  assert.equal(resolveColor(t, 14), t.colors[14]);
  assert.equal(resolveColor(t, 'bg'), t.colors[6]);
  assert.equal(resolveColor(t, '#123456'), '#123456');
  assert.equal(resolveColor(t, 'zz'), resolveColor(t, 'fg'));
  assert.equal(resolveColor(t, undefined), resolveColor(t, 'fg'));
  assert.equal(resolveColor(t, undefined, 'bg'), resolveColor(t, 'bg'));
});

test('palette: packRGBA packs little-endian ABGR for ImageData Uint32 views', () => {
  assert.equal(packRGBA('#112233'), 0xff332211);
  assert.equal(packRGBA('#000000'), 0xff000000);
});

// ---------- layout math ----------

test('layout: 1800x1100 desktop gets integer scale 4, centred', () => {
  const l = computeLayout(1800, 1100);
  assert.equal(l.scale, 4);
  assert.equal(l.width, 1280);
  assert.equal(l.height, 800);
  assert.equal(l.x, 260);
  assert.equal(l.y, 150);
});

test('layout: 390x844 phone gets scale 1 and fits width', () => {
  const l = computeLayout(390, 844);
  assert.equal(l.scale, 1);
  assert.ok(l.x >= 0 && l.x + l.width <= 390);
  assert.equal(l.x, 35);
});

test('layout: phone at devicePixelRatio 3 scales in device pixels', () => {
  const l = computeLayout(390 * 3, 844 * 3);
  assert.equal(l.scale, 3);
  assert.ok(l.x + l.width <= 1170);
});

test('layout: always integer and offsets integral for a sweep of sizes', () => {
  for (let w = 320; w <= 4000; w += 37) {
    for (const h of [200, 480, 777, 1080, 2160]) {
      const l = computeLayout(w, h);
      assert.ok(Number.isInteger(l.scale) && l.scale >= 1, `${w}x${h}`);
      assert.ok(Number.isInteger(l.x) && Number.isInteger(l.y));
      assert.ok(l.width <= w && l.height <= h, `${w}x${h} overflows`);
    }
  }
});

test('layout: border shrinks before scale drops; 4K gets big scale', () => {
  assert.equal(computeLayout(330, 210).scale, 1); // no room for full border, still 1:1
  assert.equal(computeLayout(3840, 2160).scale, 9);
});

test('layout: small phones at dpr 2-3 do not lose a whole scale step to the border', () => {
  assert.equal(computeLayout(360 * 2, 640 * 2).scale, 2); // 360 CSS px @2x
  assert.equal(computeLayout(375 * 3, 667 * 3).scale, 3); // iPhone SE-ish @3x
  assert.equal(computeLayout(412 * 2.625 | 0, 915 * 2.625 | 0).scale, 3); // Pixel @2.625x
});

test('layout: smaller than the bitmap falls back to a fractional downscale', () => {
  const l = computeLayout(160, 100);
  assert.equal(l.scale, 0.5);
  assert.ok(l.width <= 160);
  assert.equal(computeLayout(0, 0).scale > 0, true);
});

// ---------- cell buffer ----------

test('cells: geometry defaults to 40x25', () => {
  assert.equal(SCREEN_COLS, 40);
  assert.equal(SCREEN_ROWS, 25);
  const b = createCellBuffer();
  assert.equal(b.cols, 40);
  assert.equal(b.rows, 25);
  assert.equal(b.get(0, 0).ch, ' ');
});

test('cells: put/print store chars and colours, clip at edges, mark dirty', () => {
  const b = createCellBuffer(10, 3);
  b.takeDirty();
  b.print(7, 1, 'HELLO', '2', '0');
  assert.equal(b.get(7, 1).ch, 'H');
  assert.equal(b.get(9, 1).ch, 'L');
  assert.equal(b.get(9, 1).fg, '2');
  assert.equal(b.get(9, 1).bg, '0');
  assert.equal(b.get(10, 1), null);
  assert.deepEqual(b.takeDirty().sort((a, c) => a - c), [17, 18, 19]);
  assert.deepEqual(b.takeDirty(), []);
  b.put(-1, 0, 'X');
  b.put(0, 5, 'X');
  assert.deepEqual(b.takeDirty(), []);
});

test('cells: print handles astral/box characters per code point', () => {
  const b = createCellBuffer(10, 1);
  b.print(0, 0, '┌─£');
  assert.equal(b.get(0, 0).ch, '┌');
  assert.equal(b.get(2, 0).ch, '£');
});

test('cells: unchanged writes do not re-dirty', () => {
  const b = createCellBuffer(4, 1);
  b.put(0, 0, 'A', '1', '0');
  b.takeDirty();
  b.put(0, 0, 'A', '1', '0');
  assert.deepEqual(b.takeDirty(), []);
});

test('cells: fill, clearRegion and invert', () => {
  const b = createCellBuffer(5, 5);
  b.fill({ x: 1, y: 1, w: 2, h: 2 }, '#', '7', '0');
  assert.equal(b.get(2, 2).ch, '#');
  assert.equal(b.get(3, 3).ch, ' ');
  b.invert(2, 2);
  assert.equal(b.get(2, 2).inverse, true);
  b.invert(2, 2);
  assert.equal(b.get(2, 2).inverse, false);
  b.clearRegion({ x: 0, y: 0, w: 5, h: 5 });
  assert.equal(b.get(2, 2).ch, ' ');
  assert.equal(b.get(2, 2).fg, null);
  b.fill({ x: 3, y: 3, w: 10, h: 10 }, '*'); // clipped, no throw
  assert.equal(b.get(4, 4).ch, '*');
});

test('cells: scrollUp moves rows within the region only and blanks the last row', () => {
  const b = createCellBuffer(3, 4);
  for (let y = 0; y < 4; y++) b.print(0, y, String(y).repeat(3), String(y));
  b.scrollUp(1, 3);
  assert.equal(b.get(0, 0).ch, '0');
  assert.equal(b.get(0, 1).ch, '2');
  assert.equal(b.get(0, 1).fg, '2');
  assert.equal(b.get(0, 2).ch, '3');
  assert.equal(b.get(0, 3).ch, ' ');
  assert.equal(b.get(0, 3).fg, null);
});

test('cells: markAll dirties every cell', () => {
  const b = createCellBuffer(4, 2);
  b.takeDirty();
  b.markAll();
  assert.equal(b.takeDirty().length, 8);
});

// ---------- glyph pixels ----------

test('glyphPixels: expands 8 bytes LSB-first into 64 fg/bg pixels', () => {
  const px = glyphPixels([0x01, 0x80, 0, 0, 0, 0, 0, 0xff], 7, 9);
  assert.equal(px.length, 64);
  assert.equal(px[0], 7);
  assert.equal(px[1], 9);
  assert.equal(px[7], 9);
  assert.equal(px[8 + 7], 7);
  assert.equal(px[8], 9);
  for (let i = 56; i < 64; i++) assert.equal(px[i], 7);
});
