#!/usr/bin/env node
// Terminal player (PLAN §3.4, ARCHITECTURE A10.1 terminal adapter): the same engine as
// the browser, rendering Output Events as plain text.
//
//   npm run play -- [--content path] [--seed n] [--script file] [--verbose-events]
//                   [--saves dir] [--import file]
//
//   --content         content bundle module (default src/content/index.js; falls back to
//                     tests/fixtures/mini-world.js while the real content is empty)
//   --seed            uint32 seed (default 1, so transcripts are reproducible)
//   --script          one command per line ('#' lines are comments); prints a transcript
//   --verbose-events  also show [picture: id], [sfx: id], [ambient: id], [status: …], …
//   --saves           save directory (default ./saves): slot<N>.json, tallyman-save.json
//   --import          file IMPORT reads (default <saves>/tallyman-save.json)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import readline from 'node:readline';
import { createGame } from '../src/engine/game.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THEME_NAMES = { c64: 'Commodore 64', spectrum: 'ZX Spectrum', amber: 'Amber' };
const THEME_ORDER = ['c64', 'spectrum', 'amber'];

/** Parses argv into options. */
function parseArgs(argv) {
  const opts = { content: null, seed: 1, script: null, verbose: false, saves: 'saves', importFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--content') opts.content = val();
    else if (a === '--seed') opts.seed = Number(val()) >>> 0;
    else if (a === '--script') opts.script = val();
    else if (a === '--verbose-events') opts.verbose = true;
    else if (a === '--saves') opts.saves = val();
    else if (a === '--import') opts.importFile = val();
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

/** Loads a content bundle module; the real content falls back to the mini-world while empty. */
async function loadContent(path) {
  const load = async (p) => {
    const mod = await import(pathToFileURL(resolve(p)).href);
    return mod.default ?? mod.content;
  };
  if (path) return load(path);
  const real = await load(join(ROOT, 'src/content/index.js'));
  if (real && real.rooms && Object.keys(real.rooms).length) return real;
  process.stderr.write('play: src/content is still empty - using tests/fixtures/mini-world.js\n');
  return load(join(ROOT, 'tests/fixtures/mini-world.js'));
}

/**
 * The host: renders events as text and services storage / host requests (A10.2).
 * Storage never ends the session: a save or export that cannot be written is kept in
 * memory for this session (as the browser adapter does, A10.1), the reason is printed,
 * and LOAD / IMPORT read the in-memory copy.
 * @param {import('../src/engine/types.js').Game} game
 * @param {{saves: string, verbose?: boolean, importFile?: string|null}} opts
 * @param {(line: string) => void} out
 * @returns {{render: (events: object[]) => void, readonly quit: boolean}}
 */
export function createHost(game, opts, out) {
  const settings = { sound: 'on', music: 'on', typewriter: 'on', theme: 'c64' };
  const savesDir = resolve(opts.saves);
  const slotFile = (n) => join(savesDir, `slot${n}.json`);
  const exportFile = join(savesDir, 'tallyman-save.json');
  let quit = false;

  /** file path → save text kept after a failed write (newer than the file, if any). */
  const memory = new Map();

  /** Writes a save file; returns null on success, else the reason (the save stays in memory). */
  const writeJson = (file, data) => {
    const text = `${JSON.stringify(data, null, 2)}\n`;
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
      memory.delete(file);
      return null;
    } catch (e) {
      memory.set(file, text);
      return String(e?.code ?? e?.message ?? e);
    }
  };
  const readJson = (file) => {
    if (memory.has(file)) return memory.get(file);
    try {
      return existsSync(file) ? readFileSync(file, 'utf8') : null;
    } catch {
      return null;
    }
  };

  function setting(key, value) {
    if (key === 'theme') {
      settings.theme = value === 'next' ? THEME_ORDER[(THEME_ORDER.indexOf(settings.theme) + 1) % THEME_ORDER.length] : value;
      out(`Theme: ${THEME_NAMES[settings.theme] ?? settings.theme}.`);
      return;
    }
    settings[key] = value === 'toggle' ? (settings[key] === 'on' ? 'off' : 'on') : value;
    out(`${key[0].toUpperCase()}${key.slice(1)} ${settings[key]}.`);
  }

  function loadText(text, okMsg, failMsg) {
    const res = game.load(text);
    if (res.ok) {
      render(res.events);
      out(okMsg);
    } else {
      out(failMsg.replace('{error}', res.error));
    }
  }

  function render(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'text':
          if (ev.style === 'title') out('');
          out(ev.text);
          break;
        case 'prompt':
          out(ev.text);
          break;
        case 'end':
          out('');
          out(`*** ${ev.title} ***`);
          if (ev.text) out(ev.text);
          out(`You scored ${ev.score} of a possible ${ev.maxScore} in ${ev.turns} turns, giving you the rank of ${ev.rank}.`);
          out('(UNDO, LOAD n, RESTART or IMPORT.)');
          break;
        case 'clear':
          if (opts.verbose) out('[clear]');
          out('');
          break;
        case 'storage':
          if (ev.op === 'save') {
            const failed = writeJson(slotFile(ev.slot), ev.data);
            if (failed === null) out(`Saved in slot ${ev.slot}.`);
            else {
              out(`Couldn't write ${slotFile(ev.slot)}: ${failed}.`);
              out(`Saved in slot ${ev.slot} for this session only. Use EXPORT to keep a copy.`);
            }
          } else {
            const text = readJson(slotFile(ev.slot));
            if (text === null) out(`Slot ${ev.slot} is empty.`);
            else loadText(text, `Restored from slot ${ev.slot}.`, 'That save can\'t be loaded: {error}');
          }
          break;
        case 'host':
          if (ev.op === 'export') {
            const failed = writeJson(exportFile, ev.data);
            if (failed === null) out('Save exported as tallyman-save.json.');
            else {
              out(`Couldn't export the save to ${exportFile}: ${failed}.`);
              out('It is kept for this session only - IMPORT can still read it.');
            }
          } else if (ev.op === 'import') {
            const text = readJson(opts.importFile ? resolve(opts.importFile) : exportFile);
            if (text === null) out('Import cancelled.');
            else loadText(text, 'Save imported.', 'That file can\'t be loaded: {error}');
          } else if (ev.op === 'quit') {
            quit = true;
          } else if (ev.op === 'setting') {
            setting(ev.key, ev.value);
          }
          break;
        default:
          if (opts.verbose) out(verboseLine(ev));
      }
    }
  }

  return { render, get quit() { return quit; } };
}

/** One-line rendering of presentation events for --verbose-events. */
function verboseLine(ev) {
  switch (ev.type) {
    case 'picture': return `[picture: ${ev.graphics ? ev.id ?? 'none' : 'hidden'}]`;
    case 'status': return `[status: ${ev.room} | ${ev.time} | score ${ev.score}/${ev.maxScore} | nerve ${ev.nerve} | turn ${ev.turns}]`;
    case 'pause': return `[pause: ${ev.ms}]`;
    default: return `[${ev.type}: ${ev.id ?? ''}]`;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(`${readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(4, 16).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')}\n`);
    return;
  }
  const content = await loadContent(opts.content);
  const game = createGame({ content, seed: opts.seed });
  const out = (line) => process.stdout.write(`${line}\n`);
  const host = createHost(game, opts, out);
  host.render(game.start());
  // One command; a host-side failure is reported and the session goes on.
  const step = (line) => {
    try {
      host.render(game.input(line));
    } catch (e) {
      out(`(play: ${e?.message ?? e})`);
    }
  };

  if (opts.script) {
    const lines = readFileSync(resolve(opts.script), 'utf8').split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
      if (line.trim().startsWith('#')) continue;
      out('');
      out(`> ${line}`);
      step(line);
      if (host.quit) break;
    }
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '\n> ' });
  rl.prompt();
  rl.on('line', (line) => {
    step(line);
    if (host.quit) rl.close();
    else rl.prompt();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    process.stderr.write(`play: ${e.message}\n`);
    process.exitCode = 1;
  });
}
