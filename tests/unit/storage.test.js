// TT-012: browser StorageAdapter (ARCHITECTURE A10.1) — localStorage probing, the in-memory
// fallback when it is missing or throws, quota failures, settings persistence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStorageAdapter, probeStorage, getLocalStorage, loadSettings, formatSlot,
  STORAGE_NOTICE, SAVE_PREFIX, SETTING_PREFIX, SETTING_DEFAULTS,
} from '../../src/ui/storage.js';

/** Minimal Storage fake; `fail` = {set, get, remove} makes that method throw. */
function fakeStorage({ fail = {}, quotaAfter = Infinity } = {}) {
  const map = new Map();
  return {
    map,
    getItem(k) { if (fail.get) throw new Error('get denied'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      if (fail.set) throw new Error('SecurityError');
      if (k !== 'tallyman.probe' && map.size >= quotaAfter) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem(k) { if (fail.remove) throw new Error('remove denied'); map.delete(k); },
  };
}

const SAVE = { format: 'tallyman-save', game: 'tallyman', summary: { room: 'Mill Yard', time: '22:41', score: 35, turns: 142 }, state: { v: 1 } };

test('probeStorage: working, throwing, missing', () => {
  assert.equal(probeStorage(fakeStorage()), true);
  assert.equal(probeStorage(fakeStorage({ fail: { set: true } })), false);
  assert.equal(probeStorage(fakeStorage({ fail: { remove: true } })), false);
  assert.equal(probeStorage(null), false);
  assert.equal(probeStorage(undefined), false);
  assert.equal(probeStorage({}), false);
});

test('getLocalStorage survives a throwing getter', () => {
  const win = {};
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('denied'); } });
  assert.equal(getLocalStorage(win), null);
  assert.equal(getLocalStorage({}), null);
  const ls = fakeStorage();
  assert.equal(getLocalStorage({ localStorage: ls }), ls);
});

test('persistent adapter round-trips saves under tallyman.save.<slot>', () => {
  const ls = fakeStorage();
  const a = createStorageAdapter({ storage: ls });
  assert.equal(a.persistent, true);
  assert.equal(a.takeNotice(), null);
  assert.equal(a.read(1), null);
  assert.equal(a.write(1, SAVE), true);
  assert.ok(ls.map.has(`${SAVE_PREFIX}1`));
  assert.deepEqual(a.read(1), SAVE);
  assert.equal(ls.map.has('tallyman.probe'), false, 'probe key removed');
});

test('read returns null for unparseable JSON and for a throwing getItem', () => {
  const ls = fakeStorage();
  ls.map.set(`${SAVE_PREFIX}2`, '{not json');
  const a = createStorageAdapter({ storage: ls });
  assert.equal(a.read(2), null);
  const b = createStorageAdapter({ storage: fakeStorage({ fail: { get: true } }) });
  assert.equal(b.persistent, true);
  assert.equal(b.read(1), null);
});

test('missing localStorage: in-memory slots, one notice per session', () => {
  const a = createStorageAdapter({ storage: null });
  assert.equal(a.persistent, false);
  assert.equal(a.takeNotice(), STORAGE_NOTICE);
  assert.equal(a.takeNotice(), null, 'only once');
  assert.equal(a.write(3, SAVE), false, 'not persistent');
  assert.deepEqual(a.read(3), SAVE, 'kept in memory');
  assert.equal(a.read(1), null);
});

test('throwing localStorage behaves like a missing one and never throws', () => {
  const a = createStorageAdapter({ storage: fakeStorage({ fail: { set: true, get: true, remove: true } }) });
  assert.equal(a.persistent, false);
  assert.doesNotThrow(() => a.write(1, SAVE));
  assert.deepEqual(a.read(1), SAVE);
  assert.equal(a.writeSetting('sound', 'off'), false);
  assert.equal(a.readSetting('sound'), 'off');
});

test('quota failure keeps the save in memory and LOAD still finds it', () => {
  const ls = fakeStorage({ quotaAfter: 0 });
  const a = createStorageAdapter({ storage: ls });
  assert.equal(a.persistent, true);
  assert.equal(a.write(1, SAVE), false);
  assert.deepEqual(a.read(1), SAVE);
  assert.equal(a.takeNotice(), null, 'storage works in general: no notice');
});

test('write of unserialisable data returns false', () => {
  const a = createStorageAdapter({ storage: fakeStorage() });
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(a.write(1, cyclic), false);
  assert.equal(a.read(1), null);
});

test('list() summarises filled slots', () => {
  const a = createStorageAdapter({ storage: fakeStorage() });
  a.write(1, SAVE);
  a.write(3, { ...SAVE, summary: { room: 'Platform', time: '21:30', score: 0 } });
  assert.deepEqual(a.list().map((s) => s.label), ['1: Mill Yard 22:41 SC 35', '3: Platform 21:30 SC 0']);
  assert.equal(formatSlot(2, null), '2: (unknown)');
});

test('settings persist under tallyman.setting.<key>; invalid stored values are ignored', () => {
  const ls = fakeStorage();
  const a = createStorageAdapter({ storage: ls });
  assert.equal(a.writeSetting('theme', 'spectrum'), true);
  assert.equal(ls.map.get(`${SETTING_PREFIX}theme`), 'spectrum');
  assert.equal(a.readSetting('theme'), 'spectrum');
  ls.map.set(`${SETTING_PREFIX}sound`, 'loud');
  assert.equal(a.readSetting('sound'), null);
  assert.equal(a.readSetting('nonsense'), null);
  const b = createStorageAdapter({ storage: ls });
  assert.deepEqual(loadSettings(b), { ...SETTING_DEFAULTS, theme: 'spectrum' });
});

test('loadSettings: defaults, reduced motion turns the typewriter off unless stored', () => {
  const a = createStorageAdapter({ storage: null });
  assert.deepEqual(loadSettings(a), { sound: 'on', music: 'on', typewriter: 'on', theme: 'c64' });
  assert.equal(loadSettings(a, { reducedMotion: true }).typewriter, 'off');
  a.writeSetting('typewriter', 'on');
  assert.equal(loadSettings(a, { reducedMotion: true }).typewriter, 'on');
  assert.deepEqual(loadSettings({ readSetting() { throw new Error('x'); } }), { ...SETTING_DEFAULTS });
});
