import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOT_TIMING, PHASES, C64_BANNER, C64_LOAD, PROGRAM,
  bootFlavour, bootStart, createBootMachine, bootScene, stripeBands,
} from '../../src/ui/boot.js';

const types = (fx) => fx.map((e) => (e.type === 'phase' ? `phase:${e.phase}` : e.type === 'tape' ? `tape:${e.on}` : e.type === 'music' ? `music:${e.id}` : e.type));

/** Total of the timed phases before 'play' (power + type). */
const toPlay = (f) => BOOT_TIMING[f].power + BOOT_TIMING[f].type;

test('flavour and start: themes, params, reduced motion, scripts', () => {
  assert.equal(bootFlavour('c64'), 'c64');
  assert.equal(bootFlavour('amber'), 'c64');
  assert.equal(bootFlavour('spectrum'), 'spectrum');
  assert.equal(bootStart({}), 'power');
  assert.equal(bootStart({ skipboot: '1' }), 'title');
  assert.equal(bootStart({ boot: 'title' }), 'title');
  assert.equal(bootStart({ reducedMotion: true }), 'title');
  assert.equal(bootStart({ boot: 'off' }), 'game');
  assert.equal(bootStart({ scripted: true, skipboot: '1' }), 'game');
  assert.equal(bootStart({ skipboot: '0' }), 'power');
});

for (const flavour of ['c64', 'spectrum']) {
  test(`${flavour}: timed phases run power -> type -> play and wait there`, () => {
    const m = createBootMachine({ flavour, now: 1000 });
    assert.deepEqual(types(m.initial), ['phase:power']);
    assert.deepEqual(m.tick(1000 + BOOT_TIMING[flavour].power - 1), []);
    assert.deepEqual(types(m.tick(1000 + BOOT_TIMING[flavour].power)), ['phase:type']);
    assert.deepEqual(types(m.tick(1000 + toPlay(flavour))), ['phase:play']);
    assert.deepEqual(m.tick(1000 + 60_000), [], 'PRESS PLAY waits forever');
    assert.equal(m.phase, 'play');
  });

  test(`${flavour}: PLAY key -> search (tape on) -> load -> title (tape off, title music)`, () => {
    const m = createBootMachine({ flavour, now: 0 });
    m.tick(toPlay(flavour));
    assert.deepEqual(types(m.key(5000)), ['phase:search', 'tape:true']);
    const t = BOOT_TIMING[flavour];
    assert.deepEqual(types(m.tick(5000 + t.search)), ['phase:load']);
    assert.deepEqual(types(m.tick(5000 + t.search + t.load)), ['phase:title', 'tape:false', 'music:title']);
    assert.deepEqual(types(m.key(5000 + t.search + t.load + BOOT_TIMING.titleMinMs)), ['phase:done', 'music:stop', 'start']);
    assert.equal(m.phase, 'done');
    assert.deepEqual(m.key(99_999), [], 'keys after done do nothing');
  });

  test(`${flavour}: a late tick catches up through several phases in order`, () => {
    const m = createBootMachine({ flavour, now: 0 });
    assert.deepEqual(types(m.tick(100_000)), ['phase:type', 'phase:play']);
    m.key(100_000);
    const fx = types(m.tick(200_000));
    assert.deepEqual(fx, ['phase:load', 'phase:title', 'tape:false', 'music:title']);
  });
}

test('any key during power, type, search or load skips to the title', () => {
  for (const at of ['power', 'type', 'search', 'load']) {
    const m = createBootMachine({ now: 0 });
    let now = 0;
    while (m.phase !== at) {
      if (m.phase === 'play') m.key(now);
      now += 50;
      m.tick(now);
    }
    const fx = types(m.key(now + 10));
    assert.equal(m.phase, 'title', at);
    assert.ok(fx.includes('music:title'), at);
    assert.equal(fx.includes('tape:false'), at === 'search' || at === 'load', `${at}: tape stopped only if running`);
  }
});

test('title: keys inside titleMinMs are ignored (held / double keys)', () => {
  const m = createBootMachine({ now: 0 });
  m.key(10); // skip
  assert.equal(m.phase, 'title');
  assert.deepEqual(m.key(10 + BOOT_TIMING.titleMinMs - 1), []);
  assert.equal(m.phase, 'title');
  assert.deepEqual(types(m.key(10 + BOOT_TIMING.titleMinMs)), ['phase:done', 'music:stop', 'start']);
});

test('title without a prior gesture (skipboot / reduced motion): the first key starts the game (TT-106)', () => {
  // R2-1 issue 2: no silent "unlock the tune" key; the start bundle's music stop cuts the tune
  const m = createBootMachine({ start: 'title', now: 0 });
  assert.deepEqual(types(m.initial), ['phase:title', 'music:title']);
  assert.deepEqual(types(m.key(5000)), ['phase:done', 'music:stop', 'start']);
  assert.equal(m.phase, 'done');
  assert.equal('holdForMusic' in m, false, 'no hold state any more');
});

test('title reached by QUIT: one key starts, after the debounce', () => {
  const quit = createBootMachine({ start: 'title', now: 1000 });
  assert.deepEqual(quit.key(1000 + BOOT_TIMING.titleMinMs - 1), [], 'held / double key ignored');
  assert.deepEqual(types(quit.key(1000 + BOOT_TIMING.titleMinMs)), ['phase:done', 'music:stop', 'start']);
});

test('PHASES lists every phase the machine can be in', () => {
  const seen = new Set();
  const m = createBootMachine({ now: 0 });
  let now = 0;
  seen.add(m.phase);
  while (m.phase !== 'done' && now < 60_000) {
    now += 20;
    m.tick(now);
    seen.add(m.phase);
    if (m.phase === 'play' || (m.phase === 'title' && now % 1000 === 0)) m.key(now);
    seen.add(m.phase);
  }
  assert.deepEqual([...seen], PHASES);
});

const text = (scene) => Object.fromEntries(scene.lines.map((l) => [l.y, l.text]));

test('c64 scenes: the real power-on screen, typed LOAD, the tape messages', () => {
  assert.deepEqual(bootScene('c64', 'power', 0).lines, [], 'blank before the KERNAL banner');
  const power = bootScene('c64', 'power', 800);
  assert.deepEqual(text(power), {
    1: '    **** COMMODORE 64 BASIC V2 ****',
    3: ' 64K RAM SYSTEM  38911 BASIC BYTES FREE',
    5: 'READY.',
  });
  assert.equal(C64_BANNER[1].text.length, 39);
  assert.deepEqual(power.cursor && [power.cursor.x, power.cursor.y], [0, 6]);
  assert.equal(C64_LOAD, 'LOAD"TALLYMAN",1');
  const mid = bootScene('c64', 'type', 300 + 70 * 4 + 1);
  assert.equal(text(mid)[6], 'LOAD"');
  assert.equal(mid.cursor.x, 5);
  assert.equal(text(bootScene('c64', 'type', BOOT_TIMING.c64.type - 1))[6], C64_LOAD, 'fully typed before the phase ends');
  assert.equal(text(bootScene('c64', 'play', 0))[8], 'PRESS PLAY ON TAPE');
  const searching = bootScene('c64', 'search', 300);
  assert.equal(text(searching)[9], 'OK');
  assert.equal(text(searching)[11], `SEARCHING FOR ${PROGRAM}`);
  const blank = bootScene('c64', 'search', 900);
  assert.equal(blank.paper, 'border', 'screen blanked to the border colour while searching');
  assert.deepEqual(blank.lines, []);
  const found = bootScene('c64', 'search', 2000);
  assert.equal(text(found)[12], `FOUND ${PROGRAM}`);
  assert.equal(text(found)[13], 'LOADING');
});

test('c64 load: turbo stripes, picture revealed in full colour, complete before the end', () => {
  const early = bootScene('c64', 'load', 0);
  assert.equal(early.stripes, 'c64');
  assert.equal(early.reveal.cells, 0);
  assert.equal(early.reveal.mono, false);
  const mid = bootScene('c64', 'load', 1750);
  assert.ok(mid.reveal.cells > 400 && mid.reveal.cells < 600, String(mid.reveal.cells));
  assert.equal(bootScene('c64', 'load', BOOT_TIMING.c64.load - 1).reveal.cells, 1000);
});

test('spectrum scenes: copyright, K/L cursor and LOAD "", pilot, header, Program:', () => {
  const black = bootScene('spectrum', 'power', 100);
  assert.equal(black.paper, '0');
  assert.equal(black.border, '0');
  assert.equal(text(bootScene('spectrum', 'power', 600))[24], '(c) 1982 Sinclair Research Ltd');
  const k = bootScene('spectrum', 'type', 100);
  assert.equal(k.cursor.ch, 'K');
  const typed = bootScene('spectrum', 'type', 1000);
  assert.equal(text(typed)[24], 'LOAD ""');
  assert.equal(typed.cursor.ch, 'L');
  assert.equal(typed.cursor.x, 7);
  assert.equal(bootScene('spectrum', 'type', 1400).lines.length, 0, 'ENTER clears the edit line');
  assert.match(text(bootScene('spectrum', 'play', 0))[24], /press any key/);
  assert.equal(bootScene('spectrum', 'search', 0).stripes, 'pilot');
  assert.equal(bootScene('spectrum', 'search', 1350).stripes, 'data', 'header block');
  const prog = bootScene('spectrum', 'search', 1600);
  assert.equal(prog.stripes, 'pilot');
  assert.equal(text(prog)[0], `Program: ${PROGRAM}`);
});

test('spectrum load: monochrome bitmap first, then the attributes flood in', () => {
  const mid = bootScene('spectrum', 'load', 1450);
  assert.equal(mid.stripes, 'data');
  assert.equal(mid.reveal.mono, true);
  assert.equal(mid.reveal.attrRows, 0);
  assert.equal(mid.reveal.cells, 500);
  const attrs = bootScene('spectrum', 'load', 3100);
  assert.equal(attrs.reveal.cells, 1000);
  assert.ok(attrs.reveal.attrRows > 5 && attrs.reveal.attrRows < 25, String(attrs.reveal.attrRows));
  assert.equal(bootScene('spectrum', 'load', BOOT_TIMING.spectrum.load - 1).reveal.attrRows, 25);
});

test('title scene: black border and paper in both flavours', () => {
  for (const f of ['c64', 'spectrum']) {
    const s = bootScene(f, 'title', 0);
    assert.equal(s.title, true);
    assert.equal(s.border, '0');
    assert.equal(s.stripes, null);
  }
});

const covers = (bands, height) => {
  let y = 0;
  for (const b of bands) {
    assert.equal(b.y, y, 'contiguous');
    assert.ok(b.h > 0);
    y += b.h;
  }
  assert.equal(y, height, 'covers the full height');
};

test('stripe bands: cover the canvas, use the right colours, deterministic per tick', () => {
  for (const mode of ['c64', 'pilot', 'data']) {
    for (const [h, unit] of [[1100, 4], [844, 1], [2160, 9]]) covers(stripeBands(mode, h, unit, 17), h);
  }
  assert.deepEqual(stripeBands('c64', 500, 2, 3), stripeBands('c64', 500, 2, 3));
  assert.notDeepEqual(stripeBands('c64', 500, 2, 3), stripeBands('c64', 500, 2, 4), 'c64 bars flicker every frame');
  assert.deepEqual(new Set(stripeBands('pilot', 1000, 2, 5).map((b) => b.color)), new Set(['2', '3']), 'red/cyan pilot');
  assert.deepEqual(new Set(stripeBands('data', 1000, 2, 5).map((b) => b.color)), new Set(['6', '8']), 'blue/yellow data');
  const pilot = stripeBands('pilot', 1000, 2, 0);
  assert.ok(pilot.slice(1, -1).every((b) => b.h === 20), 'pilot bands are 10 lines');
  const c64 = stripeBands('c64', 1000, 1, 9);
  assert.ok(c64.every((b) => b.h <= 3), 'c64 turbo bars are thin');
  assert.ok(new Set(c64.map((b) => b.color)).size > 8, 'multicoloured');
});
