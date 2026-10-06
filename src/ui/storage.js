// Browser StorageAdapter (ARCHITECTURE A10.1). The engine never touches storage: the host
// writes `storage save` data here and hands `read()` results to `game.load()`, which does
// all validation. localStorage may be missing or throw (file:// in some browsers, private
// mode, quota), so every access is wrapped and the adapter falls back to an in-memory Map
// for the session. Nothing in here ever throws.

export const SAVE_PREFIX = 'tallyman.save.';
export const SETTING_PREFIX = 'tallyman.setting.';
export const PROBE_KEY = 'tallyman.probe';
export const STORAGE_NOTICE =
  "Saving to this browser isn't possible here. Saves last until you close the page - use EXPORT to keep one.";

/** Presentation settings the host owns (A10.3) and their defaults. */
export const SETTING_DEFAULTS = Object.freeze({ sound: 'on', music: 'on', typewriter: 'on', theme: 'c64' });
const SETTING_VALUES = Object.freeze({
  sound: ['on', 'off'], music: ['on', 'off'], typewriter: ['on', 'off'], theme: ['c64', 'spectrum', 'amber'],
});

/**
 * Whether `ls` is a working Storage: setItem/removeItem of the probe key both succeed.
 * @param {Storage|null|undefined} ls
 * @returns {boolean}
 */
export function probeStorage(ls) {
  try {
    if (!ls || typeof ls.setItem !== 'function') return false;
    ls.setItem(PROBE_KEY, '1');
    ls.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * The localStorage of `win`, or null when reading the property itself throws (it can,
 * e.g. with cookies blocked).
 * @param {object} [win=globalThis]
 * @returns {Storage|null}
 */
export function getLocalStorage(win = globalThis) {
  try { return win.localStorage ?? null; } catch { return null; }
}

/**
 * One-line slot label for a listing: "1: Mill Yard 22:41 SC 35".
 * @param {number|string} slot
 * @param {{room?:string, time?:string, score?:number}|null|undefined} summary
 */
export function formatSlot(slot, summary) {
  if (!summary || typeof summary !== 'object') return `${slot}: (unknown)`;
  return `${slot}: ${summary.room ?? '?'} ${summary.time ?? '--:--'} SC ${summary.score ?? 0}`;
}

/**
 * Create the browser storage adapter.
 * @param {{storage?: Storage|null}} [opts]  `storage` overrides the probed localStorage
 *   (tests pass fakes; pass null to force the in-memory fallback)
 */
export function createStorageAdapter(opts = {}) {
  const ls = 'storage' in opts ? opts.storage : getLocalStorage();
  const persistent = probeStorage(ls);
  /** Saves / settings kept in memory: all of them when not persistent, else only failed writes. */
  const memory = new Map();
  let noticeShown = false;

  const lsGet = (key) => {
    if (memory.has(key)) return memory.get(key);
    if (!persistent) return null;
    try { return ls.getItem(key); } catch { return null; }
  };
  const lsSet = (key, text) => {
    if (!persistent) { memory.set(key, text); return false; }
    try {
      ls.setItem(key, text);
      memory.delete(key);
      return true;
    } catch {
      memory.set(key, text);
      return false;
    }
  };
  const parse = (text) => {
    if (typeof text !== 'string') return null;
    try { return JSON.parse(text); } catch { return null; }
  };

  return {
    /** True when saves survive closing the page (localStorage works). */
    get persistent() { return persistent; },

    /**
     * The once-per-session notice when storage is unavailable, else null. Returns it only
     * the first time it is asked for.
     * @returns {string|null}
     */
    takeNotice() {
      if (persistent || noticeShown) return null;
      noticeShown = true;
      return STORAGE_NOTICE;
    },

    /**
     * Read a save slot. Null for an empty slot or unparseable JSON (validation is the engine's).
     * @param {number|string} slot
     * @returns {object|null}
     */
    read(slot) {
      try { return parse(lsGet(SAVE_PREFIX + slot)); } catch { return null; }
    },

    /**
     * Write a save slot. False when it could not be stored persistently (it is then kept
     * in memory for the session, so LOAD still finds it).
     * @param {number|string} slot
     * @param {object} data  SaveData
     * @returns {boolean}
     */
    write(slot, data) {
      let text;
      try { text = JSON.stringify(data); } catch { return false; }
      return lsSet(SAVE_PREFIX + slot, text);
    },

    /**
     * Summaries of the filled slots among `slots`.
     * @param {Array<number|string>} [slots=[1,2,3]]
     * @returns {{slot:number|string, summary:object|null, label:string}[]}
     */
    list(slots = [1, 2, 3]) {
      const out = [];
      for (const slot of slots) {
        const data = this.read(slot);
        if (data === null) continue;
        const summary = data && typeof data === 'object' ? data.summary ?? null : null;
        out.push({ slot, summary, label: formatSlot(slot, summary) });
      }
      return out;
    },

    /**
     * A persisted presentation setting, or null when unset / invalid.
     * @param {string} key
     * @returns {string|null}
     */
    readSetting(key) {
      const v = lsGet(SETTING_PREFIX + key);
      return SETTING_VALUES[key]?.includes(v) ? v : null;
    },

    /**
     * Persist a presentation setting.
     * @param {string} key
     * @param {string} value
     * @returns {boolean} whether it was stored persistently
     */
    writeSetting(key, value) {
      return lsSet(SETTING_PREFIX + key, String(value));
    },
  };
}

/**
 * Presentation settings at boot: stored values over defaults. With no stored typewriter
 * choice, `prefers-reduced-motion` turns the typewriter off (A10.3).
 * @param {{readSetting: (key:string) => string|null}} adapter
 * @param {{reducedMotion?: boolean}} [env]
 * @returns {{sound:string, music:string, typewriter:string, theme:string}}
 */
export function loadSettings(adapter, env = {}) {
  const out = { ...SETTING_DEFAULTS };
  if (env.reducedMotion) out.typewriter = 'off';
  for (const key of Object.keys(SETTING_DEFAULTS)) {
    let v = null;
    try { v = adapter.readSetting(key); } catch { v = null; }
    if (v !== null) out[key] = v;
  }
  return out;
}
