// TT-012: the pure Output Event dispatcher (ARCHITECTURE A9, A10.2, A10.3) driven with fake
// UI ports, plus the pure status-bar / border / picture helpers it feeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDispatcher, resolveSetting, HOST_MESSAGES, EXPORT_FILENAME } from '../../src/ui/dispatch.js';
import { statusText, borderForNerve, borderAt, PULSE_MS } from '../../src/ui/statusbar.js';
import { createArtLayer, fxTick, hasFx } from '../../src/ui/picture.js';
import { createStorageAdapter } from '../../src/ui/storage.js';
import { createGame } from '../../src/engine/game.js';
import content from '../../src/content/index.js';

/**
 * A fake UI port: queued output (print/clear/pause/mark) is recorded in `queue`; `flush()`
 * plays the queue like the terminal does, running marks and logging every effect in `log`.
 */
function fakeUi(overrides = {}) {
  const queue = [];
  const log = [];
  const saved = new Map();
  const ui = {
    queue,
    log,
    print: (text, style) => queue.push(['print', text, style]),
    clear: () => queue.push(['clear']),
    pause: (ms) => queue.push(['pause', ms]),
    mark: (fn) => queue.push(['mark', fn]),
    cleared: () => log.push(['cleared']),
    room: (ev) => log.push(['room', ev.id, ev.name]),
    picture: (ev) => log.push(['picture', ev.id, ev.graphics]),
    status: (ev) => log.push(['status', ev.room, ev.time, ev.score, ev.nerve]),
    sfx: (id) => log.push(['sfx', id]),
    ambient: (id) => log.push(['ambient', id]),
    music: (id) => log.push(['music', id]),
    end: (ev) => log.push(['end', ev.ending]),
    adapter: {
      persistent: true,
      write: (slot, data) => { saved.set(slot, data); return true; },
      read: (slot) => saved.get(slot) ?? null,
      writeSetting: (k, v) => log.push(['writeSetting', k, v]),
    },
    load: () => ({ ok: false, error: 'not a Tallyman save', events: [] }),
    download: (name, text) => log.push(['download', name, text]),
    pickFile: () => Promise.resolve(null),
    setInputEnabled: (on) => log.push(['input', on]),
    quit: () => log.push(['quit']),
    applySetting: (k, v) => log.push(['apply', k, v]),
    ...overrides,
  };
  ui.flush = () => {
    while (queue.length) {
      const item = queue.shift();
      if (item[0] === 'mark') item[1]();
      else log.push(item);
    }
    return log;
  };
  return ui;
}

const sysLines = (log) => log.filter((e) => e[0] === 'print' && e[2] === 'system').map((e) => e[1]);

test('text, prompt, clear and pause are queued directly; presentation events go through mark', () => {
  const ui = fakeUi();
  const d = createDispatcher(ui);
  d.render([
    { type: 'text', text: 'Taken.' },
    { type: 'sfx', id: 'pickup' },
    { type: 'text', text: 'Hm.', style: 'whisper' },
    { type: 'pause', ms: 500 },
    { type: 'prompt', kind: 'confirm', text: 'Are you sure?' },
  ]);
  assert.deepEqual(ui.queue.map((q) => q[0]), ['print', 'mark', 'print', 'pause', 'print']);
  assert.deepEqual(ui.queue[0], ['print', 'Taken.', 'normal']);
  assert.deepEqual(ui.queue[2], ['print', 'Hm.', 'whisper']);
  assert.deepEqual(ui.queue[4], ['print', 'Are you sure?', 'normal']);
  assert.deepEqual(ui.log, [], 'nothing fires before the output reaches it');
  ui.flush();
  assert.deepEqual(ui.log.map((e) => e[0]), ['print', 'sfx', 'print', 'pause', 'print']);
});

test('the real start bundle maps in A9.3 order', () => {
  const game = createGame({ content, seed: 7 });
  const ui = fakeUi();
  createDispatcher(ui).render(game.start());
  const log = ui.flush();
  const kinds = log.map((e) => e[0]);
  assert.deepEqual(kinds.slice(0, 7), ['cleared', 'clear', 'room', 'picture', 'ambient', 'music', 'status']);
  assert.deepEqual(log[2], ['room', 'platform', 'Platform']);
  assert.deepEqual(log[3], ['picture', 'platform', true]);
  assert.deepEqual(log[5], ['music', 'stop']);
  assert.equal(log[6][1], 'Platform');
  assert.ok(kinds.slice(7).every((k) => k === 'print'), 'then intro and room text');
  assert.ok(log.some((e) => e[0] === 'print' && e[2] === 'title' && e[1] === 'Platform'));
});

test('a real move: text first, then status after the description', () => {
  const game = createGame({ content, seed: 7 });
  game.start();
  const ui = fakeUi();
  createDispatcher(ui).render(game.input('w'));
  const kinds = ui.flush().map((e) => e[0]);
  assert.ok(kinds.indexOf('room') < kinds.indexOf('picture'));
  assert.ok(kinds.indexOf('picture') < kinds.indexOf('print'));
  assert.equal(kinds[kinds.length - 1], 'status');
});

test('end: music, ending text, then the ending screen (in that order)', () => {
  const ui = fakeUi();
  createDispatcher(ui).render([
    { type: 'text', text: 'The water closes over you.' },
    { type: 'end', ending: 'death_drown', kind: 'death', title: 'Drowned', text: 'They find you at dawn.', score: 10, maxScore: 100, rank: 'Probationer', turns: 40, art: 'ending_death', music: 'ending_bad' },
  ]);
  const log = ui.flush();
  assert.deepEqual(log, [
    ['print', 'The water closes over you.', 'normal'],
    ['music', 'ending_bad'],
    ['print', 'They find you at dawn.', 'normal'],
    ['end', 'death_drown'],
  ]);
});

test('storage save: persistent vs session-only acknowledgements', () => {
  const ui = fakeUi();
  const d = createDispatcher(ui);
  d.render([{ type: 'storage', op: 'save', slot: 2, data: { x: 1 } }]);
  assert.deepEqual(sysLines(ui.flush()), ['Saved in slot 2.']);

  const mem = fakeUi({ adapter: createStorageAdapter({ storage: null }) });
  createDispatcher(mem).render([{ type: 'storage', op: 'save', slot: 1, data: { x: 1 } }]);
  assert.deepEqual(sysLines(mem.flush()), ['Saved in slot 1 for this session only. Use EXPORT to keep a copy.']);
  assert.deepEqual(mem.adapter.read(1), { x: 1 });
});

test('storage load: empty slot, bad save, success renders the bundle then acknowledges', () => {
  const ui = fakeUi();
  const d = createDispatcher(ui);
  d.render([{ type: 'storage', op: 'load', slot: 3 }]);
  assert.deepEqual(sysLines(ui.flush()), ['Slot 3 is empty.']);

  ui.adapter.write(3, { junk: true });
  d.render([{ type: 'storage', op: 'load', slot: 3 }]);
  assert.deepEqual(sysLines(ui.flush()).at(-1), "That save can't be loaded: not a Tallyman save");

  // real round trip through the engine
  const game = createGame({ content, seed: 3 });
  game.start();
  game.input('w');
  const real = fakeUi({ load: (data) => game.load(data) });
  const rd = createDispatcher(real);
  rd.render(game.input('save 1'));
  game.input('e');
  rd.render(game.input('load 1'));
  const log = real.flush();
  const kinds = log.map((e) => e[0]);
  const ack = log.findIndex((e) => e[1] === 'Restored from slot 1.');
  assert.ok(ack > kinds.lastIndexOf('clear'), 'acknowledged after the refresh bundle');
  assert.equal(ack, log.length - 1);
  assert.equal(game.snapshot().roomId, 'waiting_room');
});

test('host export downloads tallyman-save.json; a throwing download is reported', () => {
  const ui = fakeUi();
  createDispatcher(ui).render([{ type: 'host', op: 'export', data: { format: 'tallyman-save' } }]);
  const log = ui.flush();
  const dl = log.find((e) => e[0] === 'download');
  assert.equal(dl[1], EXPORT_FILENAME);
  assert.deepEqual(JSON.parse(dl[2]), { format: 'tallyman-save' });
  assert.deepEqual(sysLines(log), [HOST_MESSAGES.exported]);

  const bad = fakeUi({ download: () => { throw new Error('blocked'); } });
  createDispatcher(bad).render([{ type: 'host', op: 'export', data: {} }]);
  assert.deepEqual(sysLines(bad.flush()), ["The save couldn't be downloaded here: blocked"]);
});

test('host import: input blocked while the picker is open; cancel, bad file, success', async () => {
  const ui = fakeUi();
  const d = createDispatcher(ui);
  d.render([{ type: 'host', op: 'import' }]);
  assert.deepEqual(ui.log, [['input', false]]);
  await d.importing;
  assert.deepEqual(ui.flush().slice(-2), [['input', true], ['print', 'Import cancelled.', 'system']]);

  const bad = fakeUi({ pickFile: async () => '{"nope":1}' });
  const bd = createDispatcher(bad);
  bd.render([{ type: 'host', op: 'import' }]);
  await bd.importing;
  assert.deepEqual(sysLines(bad.flush()), ["That file can't be loaded: not a Tallyman save"]);

  const game = createGame({ content, seed: 5 });
  game.start();
  game.input('w');
  const text = JSON.stringify(game.save());
  game.input('e');
  const good = fakeUi({ pickFile: async () => text, load: (data) => game.load(data) });
  const gd = createDispatcher(good);
  gd.render([{ type: 'host', op: 'import' }]);
  assert.equal(await gd.importing, true);
  const log = good.flush();
  assert.equal(log.at(-1)[1], 'Save imported.');
  assert.ok(log.some((e) => e[0] === 'clear'));
  assert.equal(game.snapshot().roomId, 'waiting_room');

  const err = fakeUi({ pickFile: () => Promise.reject(new Error('read failed')) });
  const ed = createDispatcher(err);
  ed.render([{ type: 'host', op: 'import' }]);
  await ed.importing;
  assert.deepEqual(sysLines(err.flush()), ["That file can't be loaded: read failed"]);
});

test('host quit is deferred to its place in the output', () => {
  const ui = fakeUi();
  createDispatcher(ui).render([{ type: 'text', text: 'Bye.' }, { type: 'host', op: 'quit' }]);
  assert.deepEqual(ui.flush(), [['print', 'Bye.', 'normal'], ['quit']]);
});

test('host setting: resolve toggle/next, persist, apply in order, acknowledge', () => {
  const ui = fakeUi();
  const d = createDispatcher(ui, { settings: { theme: 'c64', sound: 'on' } });
  d.render([
    { type: 'host', op: 'setting', key: 'sound', value: 'toggle' },
    { type: 'host', op: 'setting', key: 'theme', value: 'next' },
    { type: 'host', op: 'setting', key: 'theme', value: 'amber' },
    { type: 'host', op: 'setting', key: 'typewriter', value: 'off' },
  ]);
  const log = ui.flush();
  assert.deepEqual(sysLines(log), ['Sound off.', 'Theme: ZX Spectrum.', 'Theme: Amber monitor.', 'Typewriter off.']);
  assert.deepEqual(log.filter((e) => e[0] === 'apply'), [
    ['apply', 'sound', 'off'], ['apply', 'theme', 'spectrum'], ['apply', 'theme', 'amber'], ['apply', 'typewriter', 'off'],
  ]);
  assert.deepEqual(log.filter((e) => e[0] === 'writeSetting').map((e) => e[2]), ['off', 'spectrum', 'amber', 'off']);
  assert.equal(d.settings.theme, 'amber');
  d.setting('sound', 'toggle'); // F2
  assert.equal(d.settings.sound, 'on');
});

test('resolveSetting edge cases', () => {
  assert.deepEqual(resolveSetting({ theme: 'amber' }, 'theme', 'next'), { key: 'theme', value: 'c64', ack: 'Theme: Commodore 64.' });
  assert.equal(resolveSetting({ theme: 'bogus' }, 'theme', 'next').value, 'spectrum');
  assert.equal(resolveSetting({ music: 'off' }, 'music', 'toggle').ack, 'Music on.');
  assert.equal(resolveSetting({}, 'sound', 'off').value, 'off');
});

test('the real THEME / SOUND commands reach applySetting', () => {
  const game = createGame({ content, seed: 1 });
  game.start();
  const ui = fakeUi();
  const d = createDispatcher(ui);
  d.render(game.input('theme spectrum'));
  d.render(game.input('sound'));
  const log = ui.flush();
  assert.deepEqual(log.filter((e) => e[0] === 'apply'), [['apply', 'theme', 'spectrum'], ['apply', 'sound', 'off']]);
});

test('unknown events and junk are ignored', () => {
  const ui = fakeUi();
  const d = createDispatcher(ui);
  assert.doesNotThrow(() => d.render([null, 3, { type: 'bogus' }, { type: 'host', op: 'zzz' }]));
  assert.doesNotThrow(() => d.render(undefined));
  assert.deepEqual(ui.flush(), []);
});

// ---------- status bar, border, picture helpers ----------

test('statusText: 40 wide, room left, time and score right, long names truncated', () => {
  const s = statusText({ room: 'Platform', time: '21:30', score: 0 });
  assert.equal(s.length, 40);
  assert.equal(s, ` Platform${' '.repeat(19)}21:30  SC 0 `);
  const long = statusText({ room: 'A'.repeat(60), time: '23:59', score: 100 });
  assert.equal(long.length, 40);
  assert.ok(long.endsWith(' 23:59  SC 100 '));
  assert.ok(long.startsWith(' AAAA'));
  assert.equal(statusText({}).length, 40);
});

test('border by nerve: theme < 50, purple 50-79, red pulse >= 80 (static if reduced motion)', () => {
  assert.deepEqual(borderForNerve(0), { color: 'border', pulse: false });
  assert.deepEqual(borderForNerve(49), { color: 'border', pulse: false });
  assert.deepEqual(borderForNerve(50), { color: '4', pulse: false });
  assert.deepEqual(borderForNerve(79), { color: '4', pulse: false });
  assert.deepEqual(borderForNerve(80), { color: '2', pulse: true });
  const red = borderForNerve(95);
  const seen = new Set(Array.from({ length: 20 }, (_, i) => borderAt(red, (i * PULSE_MS) / 20)));
  assert.deepEqual([...seen].sort(), ['2', 'a']);
  assert.equal(borderAt(red, 0, true), '2');
  assert.equal(borderAt(borderForNerve(60), 123), '4');
});

test('art layer: draws, animates fx only when allowed, restores cells between frames', () => {
  const cells = new Map();
  const screen = { put: (x, y, ch, fg, bg) => cells.set(`${x},${y}`, `${ch}|${fg}|${bg}`) };
  const def = content.art.market_square;
  assert.ok(hasFx(def));
  const layer = createArtLayer(screen, { top: 1 });
  layer.set(def);
  assert.equal(cells.size, 40 * 9);
  const base = new Map(cells);
  let changed = 0;
  for (let t = 0; t < 30; t++) if (layer.frame((t * 1000) / 8)) changed++;
  assert.equal(changed, 30);
  assert.equal(fxTick(1000), 8);
  assert.ok([...cells].some(([k, v]) => base.get(k) !== v), 'rain changed some cells');
  layer.setReducedMotion(true);
  assert.deepEqual(new Map(cells), base, 'reduced motion restores the static picture');
  assert.equal(layer.frame(99999), false);
  layer.set(null);
  assert.equal(layer.frame(1), false);
});
