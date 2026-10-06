// Output Event dispatcher (ARCHITECTURE A9, A10.2, A10.3): maps engine events onto UI calls.
// It holds no DOM and no game logic, so tests drive it with fakes.
//
// Ordering (A9.2 O1): text, clear and pause go straight into the terminal's queue; every
// other visible or audible effect (room, picture, status, sfx, ambient, music, the ending
// screen, applying a setting) is wrapped in `ui.mark(fn)`, so it happens when the
// typewriter reaches that point rather than when the events arrive. Host requests
// (storage, export, import) are serviced at once — they are the last event of a call
// (O2) and only queue output — and their acknowledgements are printed in `system` style.
import { THEMES } from './palette.js';

export const THEME_ORDER = Object.freeze(['c64', 'spectrum', 'amber']);
export const EXPORT_FILENAME = 'tallyman-save.json';

/** Host messages (A10.2), `{n}` / `{error}` interpolated. */
export const HOST_MESSAGES = Object.freeze({
  saved: 'Saved in slot {n}.',
  savedSession: 'Saved in slot {n} for this session only. Use EXPORT to keep a copy.',
  empty: 'Slot {n} is empty.',
  restored: 'Restored from slot {n}.',
  badSave: "That save can't be loaded: {error}",
  exported: `Save exported as ${EXPORT_FILENAME}.`,
  exportFailed: "The save couldn't be downloaded here: {error}",
  importCancelled: 'Import cancelled.',
  badFile: "That file can't be loaded: {error}",
  imported: 'Save imported.',
});

const fill = (msg, params) => msg.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));

/**
 * Resolve a `host setting` event against the current settings (A10.3): `toggle` flips
 * on/off, theme `next` cycles c64 -> spectrum -> amber. Returns the new value and the
 * acknowledgement ("Sound off.", "Theme: ZX Spectrum.").
 * @param {Record<string,string>} settings
 * @param {string} key    'sound' | 'music' | 'typewriter' | 'theme'
 * @param {string} value  as in HOST_SETTINGS
 * @returns {{key:string, value:string, ack:string}}
 */
export function resolveSetting(settings, key, value) {
  if (key === 'theme') {
    const cur = THEME_ORDER.includes(settings.theme) ? settings.theme : 'c64';
    const v = value === 'next' ? THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length]
      : THEME_ORDER.includes(value) ? value : cur;
    return { key, value: v, ack: `Theme: ${THEMES[v].label}.` };
  }
  const v = value === 'toggle' ? (settings[key] === 'off' ? 'on' : 'off') : value === 'off' ? 'off' : 'on';
  return { key, value: v, ack: `${key[0].toUpperCase()}${key.slice(1)} ${v}.` };
}

/**
 * @typedef {object} DispatchUi
 * @property {(text:string, style?:string) => void} print   queue text in the terminal
 * @property {() => void} clear
 * @property {(ms:number) => void} pause
 * @property {(fn:() => void) => void} mark                  run fn when output reaches here
 * @property {() => void} [cleared]        (in mark) just before a clear: leave the ending screen
 * @property {(ev:object) => void} room
 * @property {(ev:object) => void} picture
 * @property {(ev:object) => void} status
 * @property {(id:string) => void} sfx
 * @property {(id:string) => void} ambient
 * @property {(id:string) => void} music
 * @property {(ev:object) => void} end     (in mark) after the ending text: show the ending screen
 * @property {{write:Function, read:Function, writeSetting:Function, persistent:boolean}} adapter
 * @property {(data:object|string) => {ok:boolean, error?:string, events:object[]}} load  game.load
 * @property {(name:string, text:string) => void} download
 * @property {() => Promise<string|null>} pickFile  resolves with the file text, null when cancelled
 * @property {(on:boolean) => void} setInputEnabled
 * @property {() => void} quit             (in mark) discard the game
 * @property {(key:string, value:string) => void} applySetting   (in mark)
 */

/**
 * Create a dispatcher over a UI port.
 * @param {DispatchUi} ui
 * @param {{settings?: Record<string,string>}} [opts]  initial presentation settings
 */
export function createDispatcher(ui, opts = {}) {
  const settings = { sound: 'on', music: 'on', typewriter: 'on', theme: 'c64', ...(opts.settings ?? {}) };
  /** Pending import, so tests (and the host) can await it. */
  let importing = null;
  const sys = (msg, params = {}) => ui.print(fill(msg, params), 'system');

  function loadAndRender(data, okMsg, failMsg, params) {
    const res = ui.load(data);
    if (res && res.ok) {
      render(res.events);
      sys(okMsg, params);
    } else {
      sys(failMsg, { ...params, error: res?.error ?? 'unknown error' });
    }
    return !!res?.ok;
  }

  function storage(ev) {
    if (ev.op === 'save') {
      const ok = ui.adapter.write(ev.slot, ev.data);
      sys(ok && ui.adapter.persistent ? HOST_MESSAGES.saved : HOST_MESSAGES.savedSession, { n: ev.slot });
    } else if (ev.op === 'load') {
      const data = ui.adapter.read(ev.slot);
      if (data === null || data === undefined) sys(HOST_MESSAGES.empty, { n: ev.slot });
      else loadAndRender(data, HOST_MESSAGES.restored, HOST_MESSAGES.badSave, { n: ev.slot });
    }
  }

  /**
   * Apply a presentation setting: resolve, persist, apply in order, acknowledge.
   * @param {string} key
   * @param {string} value
   * @param {{ack?: boolean}} [opts]  ack:false skips the acknowledgement text (F2 in the boot)
   */
  function setting(key, value, { ack = true } = {}) {
    const r = resolveSetting(settings, key, value);
    settings[key] = r.value;
    try { ui.adapter.writeSetting(key, r.value); } catch { /* adapter never throws; belt and braces */ }
    ui.mark(() => ui.applySetting(key, r.value));
    if (ack) sys(r.ack);
    return r;
  }

  // Runs synchronously inside the keydown that submitted IMPORT, never behind a mark():
  // that keypress's user activation is what lets pickFile()'s input.click() open the file
  // chooser in Chrome. Deferring it (even to honour O1 ordering strictly) silently breaks
  // the picker.
  function importSave() {
    ui.setInputEnabled(false);
    let p;
    try { p = Promise.resolve(ui.pickFile()); } catch (e) { p = Promise.reject(e); }
    importing = p.then(
      (text) => {
        ui.setInputEnabled(true);
        if (text === null || text === undefined) { sys(HOST_MESSAGES.importCancelled); return false; }
        return loadAndRender(text, HOST_MESSAGES.imported, HOST_MESSAGES.badFile, {});
      },
      (e) => {
        ui.setInputEnabled(true);
        sys(HOST_MESSAGES.badFile, { error: e?.message ?? String(e) });
        return false;
      },
    ).finally(() => { importing = null; });
    return importing;
  }

  function host(ev) {
    switch (ev.op) {
      case 'setting': setting(ev.key, ev.value); break;
      case 'export':
        try {
          ui.download(EXPORT_FILENAME, `${JSON.stringify(ev.data, null, 2)}\n`);
          sys(HOST_MESSAGES.exported);
        } catch (e) {
          sys(HOST_MESSAGES.exportFailed, { error: e?.message ?? String(e) });
        }
        break;
      case 'import': importSave(); break;
      case 'quit': ui.mark(() => ui.quit()); break;
      default: break;
    }
  }

  /** Dispatch one event. */
  function one(ev) {
    if (!ev || typeof ev !== 'object') return;
    switch (ev.type) {
      case 'text': ui.print(ev.text, ev.style ?? 'normal'); break;
      case 'prompt': ui.print(ev.text, 'normal'); break;
      case 'clear':
        if (ui.cleared) ui.mark(() => ui.cleared());
        ui.clear();
        break;
      case 'pause': ui.pause(ev.ms); break;
      case 'room': ui.mark(() => ui.room(ev)); break;
      case 'picture': ui.mark(() => ui.picture(ev)); break;
      case 'status': ui.mark(() => ui.status(ev)); break;
      case 'sfx': ui.mark(() => ui.sfx(ev.id)); break;
      case 'ambient': ui.mark(() => ui.ambient(ev.id)); break;
      case 'music': ui.mark(() => ui.music(ev.id)); break;
      case 'end':
        if (ev.music) ui.mark(() => ui.music(ev.music));
        if (ev.text) ui.print(ev.text, 'normal');
        ui.mark(() => ui.end(ev));
        break;
      case 'storage': storage(ev); break;
      case 'host': host(ev); break;
      default: break;
    }
  }

  /** Dispatch an event array in order (A9.2 O1). */
  function render(events) {
    if (!Array.isArray(events)) return;
    for (const ev of events) one(ev);
  }

  return {
    render,
    /** Host-side setting change (F2): same path as a `host setting` event. */
    setting,
    get settings() { return { ...settings }; },
    /** The pending import's promise, or null. */
    get importing() { return importing; },
  };
}
