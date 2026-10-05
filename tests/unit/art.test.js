// TT-019: art registry format (ARCHITECTURE A4.16) and the pure fx renderer (src/ui/fx.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { art, mergeArt } from '../../src/content/art/index.js';
import { hasGlyph } from '../../src/ui/font8x8.js';
import { ART_SIZES, PALETTE_KEYS, ART_FX } from '../../src/engine/types.js';
import { applyFx, applyAllFx, cellAt, hash01, FX_ORDER, RAIN_GLYPH } from '../../src/ui/fx.js';

const defs = Object.entries(art);
const isKey = (c) => c.length === 1 && PALETTE_KEYS.includes(c);

test('art: the style-gate pictures exist', () => {
  for (const id of ['market_square', 'weaving_shed', 'black_lamb']) assert.ok(art[id], id);
});

test('art: every def has its key as id and an allowed size', () => {
  const sizes = Object.values(ART_SIZES);
  for (const [id, a] of defs) {
    assert.equal(a.id, id);
    assert.ok(sizes.some((s) => s.w === a.w && s.h === a.h), `${id}: ${a.w}x${a.h}`);
  }
});

test('art: chars / colors / bg rows have exact dimensions (code points, not UTF-16 units)', () => {
  for (const [id, a] of defs) {
    for (const key of ['chars', 'colors']) {
      assert.equal(a[key].length, a.h, `${id}.${key} rows`);
      a[key].forEach((row, y) => assert.equal(Array.from(row).length, a.w, `${id}.${key}[${y}]`));
    }
    if (Array.isArray(a.bg)) {
      assert.equal(a.bg.length, a.h, `${id}.bg rows`);
      a.bg.forEach((row, y) => assert.equal(Array.from(row).length, a.w, `${id}.bg[${y}]`));
    } else if (a.bg !== undefined) assert.ok(isKey(a.bg), `${id}.bg`);
  }
});

test('art: only glyphs the font has', () => {
  for (const [id, a] of defs) {
    a.chars.forEach((row, y) => {
      for (const ch of row) assert.ok(hasGlyph(ch), `${id}.chars[${y}] has no glyph for U+${ch.codePointAt(0).toString(16)}`);
    });
  }
});

test('art: no lowercase letters (the C64 theme renders the upper-case set)', () => {
  for (const [id, a] of defs) a.chars.forEach((row, y) => assert.ok(!/[a-z]/.test(row), `${id}.chars[${y}]`));
});

test('art: only palette keys in colors and bg', () => {
  for (const [id, a] of defs) {
    for (const key of ['colors', 'bg']) {
      if (!Array.isArray(a[key])) continue;
      a[key].forEach((row, y) => { for (const c of row) assert.ok(isKey(c), `${id}.${key}[${y}] has ${JSON.stringify(c)}`); });
    }
  }
});

test('art: fx ids are known', () => {
  for (const [id, a] of defs) for (const fx of a.fx ?? []) assert.ok(ART_FX.includes(fx), `${id}: ${fx}`);
  assert.deepEqual([...FX_ORDER].sort(), [...ART_FX].sort());
});

test('art: mergeArt rejects a duplicate id', () => {
  const one = { a: { id: 'a' } };
  assert.throws(() => mergeArt([one, one]), /defined twice/);
  assert.deepEqual(Object.keys(mergeArt([one, { b: { id: 'b' } }])), ['a', 'b']);
});

// ---------- fx ----------

const tiny = {
  id: 'tiny', w: 40, h: 9, fx: ['rain', 'lightning', 'flicker', 'fog'],
  chars: [' '.repeat(40), ' '.repeat(40), ' '.repeat(20) + '█'.repeat(20), ...Array(6).fill('█'.repeat(40))],
  colors: [...Array(3).fill('0'.repeat(40)), ...Array(6).fill('7'.repeat(20) + 'b'.repeat(20))],
  bg: '0',
};

test('fx: cellAt resolves single-key, per-cell and missing bg', () => {
  assert.deepEqual(cellAt(tiny, 0, 0), { ch: ' ', fg: '0', bg: '0' });
  assert.equal(cellAt({ ...tiny, bg: undefined }, 0, 0).bg, '0');
  assert.equal(cellAt(art.market_square, 1, 3).ch, 'B');
});

test('fx: applyFx is deterministic per (art, fx, tick, seed)', () => {
  for (const [, a] of defs) {
    for (const fx of ART_FX) {
      for (const tick of [0, 1, 7, 123]) {
        assert.deepEqual(applyFx(a, fx, tick), applyFx(a, fx, tick));
        assert.deepEqual(applyFx(a, fx, tick, 42), applyFx(a, fx, tick, 42));
      }
    }
  }
  const seeded = (...ns) => hash01(9, ...ns);
  assert.deepEqual(applyFx(tiny, 'rain', 5, seeded), applyFx(tiny, 'rain', 5, 9));
});

test('fx: overrides are in bounds, valid and sorted row-major', () => {
  for (const [, a] of [...defs, ['tiny', tiny]]) {
    for (const fx of ART_FX) {
      for (let tick = 0; tick < 120; tick += 7) {
        const out = applyFx(a, fx, tick);
        out.forEach((o, i) => {
          assert.ok(o.x >= 0 && o.x < a.w && o.y >= 0 && o.y < a.h);
          assert.ok(hasGlyph(o.ch) && isKey(o.fg) && isKey(o.bg), JSON.stringify(o));
          if (i) assert.ok(out[i - 1].y < o.y || (out[i - 1].y === o.y && out[i - 1].x < o.x));
        });
      }
    }
  }
});

test('fx: rain moves with the tick and only touches open air and solid cells', () => {
  const frames = [0, 1, 2, 3].map((t) => applyFx(tiny, 'rain', t));
  assert.ok(frames.every((f) => f.length > 0));
  assert.notDeepEqual(frames[0], frames[1]);
  for (const f of frames) {
    for (const o of f) {
      assert.equal(o.ch, RAIN_GLYPH);
      assert.ok([' ', '█'].includes(cellAt(tiny, o.x, o.y).ch));
    }
  }
});

test('fx: lightning flashes rarely and lights only air connected to the top', () => {
  const closed = { ...tiny, chars: [...tiny.chars.slice(0, 5), '█'.repeat(10) + ' '.repeat(5) + '█'.repeat(25), ...tiny.chars.slice(6)] };
  let flashes = 0;
  for (let t = 0; t < 900; t++) {
    const out = applyFx(closed, 'lightning', t);
    if (!out.length) continue;
    flashes++;
    for (const o of out) assert.ok(o.y < 3, `cell ${o.x},${o.y} is not connected to the sky`);
  }
  assert.ok(flashes > 0 && flashes < 900 * 0.1, `flash frames: ${flashes}`);
});

test('fx: flicker only ever dims light colours', () => {
  let changed = 0;
  for (let t = 0; t < 60; t++) {
    for (const o of applyFx(tiny, 'flicker', t)) {
      changed++;
      assert.equal(cellAt(tiny, o.x, o.y).fg, '7');
      assert.ok(['f', 'c'].includes(o.fg));
    }
  }
  assert.ok(changed > 0);
});

test('fx: fog drifts over dark open and solid cells', () => {
  const a = applyFx(tiny, 'fog', 0), b = applyFx(tiny, 'fog', 40);
  assert.ok(a.length > 0);
  assert.notDeepEqual(a, b);
  for (const o of a) assert.ok(['░', '▒'].includes(o.ch));
});

test('fx: applyAllFx layers the def\'s effects; unknown ids throw', () => {
  assert.deepEqual(applyAllFx(art.black_lamb, 5), []);
  const all = applyAllFx(tiny, 3);
  assert.deepEqual(all, applyAllFx(tiny, 3));
  const keys = all.map((o) => o.y * 40 + o.x);
  assert.equal(new Set(keys).size, keys.length);
  assert.throws(() => applyFx(tiny, 'snow', 0), RangeError);
  assert.throws(() => applyAllFx(tiny, 0, 0, ['snow']), RangeError);
});
