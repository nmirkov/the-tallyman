// TT-022 — Save determinism (PLAN §4 "Save determinism", §3.8; ARCHITECTURE A2 G1, A9.3,
// A11): save at >= 10 points of the reference walkthrough -> load into a fresh game built
// with a DIFFERENT seed -> replay the remainder -> identical events and final state (RNG,
// pending prompts, timers, evidence, score, endings). Saves holding a pending question and
// saves after an ending restore exactly. Invalid saves are rejected atomically.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/engine/game.js';
import { validateSave } from '../../src/engine/state.js';
import { cloneContent } from '../fixtures/harness.js';
import { content, WALKTHROUGH, BOILER_ROUTE, times, joined, endOf, fresh, snap } from './script.js';

/** A fresh game whose own seed differs from the reference (seed 1). */
const otherGame = () => createGame({ content: cloneContent(content), seed: 0xC0FFEE, strict: true });

/**
 * Plays `script` once from scratch recording each command's events, and at every index in
 * `points` takes a save (via the SAVE command's storage event AND `game.save()`).
 */
function reference(script, points) {
  const g = fresh();
  const perLine = [];
  const saves = new Map();
  for (let i = 0; i <= script.length; i++) {
    if (points.includes(i)) {
      const viaCommand = g.input('save 1');
      const req = viaCommand.at(-1);
      assert.equal(req.type, 'storage');
      assert.equal(req.op, 'save');
      saves.set(i, { cmd: JSON.stringify(req.data), api: JSON.stringify(g.save()) });
    }
    if (i < script.length) perLine.push(g.input(script[i]));
  }
  return { perLine, saves, final: g.snapshot() };
}

/** Loads `json` into a new game, replays `script` from `from`, compares with `ref`. */
function replayAndCompare(ref, script, from, json, label) {
  const g = otherGame();
  g.start();
  const r = g.load(json);
  assert.ok(r.ok, `${label}: load failed: ${r.error}`);
  for (let i = from; i < script.length; i++) {
    const ev = g.input(script[i]);
    assert.deepEqual(ev, ref.perLine[i], `${label}: events differ at #${i + 1} "${script[i]}"`);
  }
  assert.deepEqual(g.snapshot(), ref.final, `${label}: final state`);
}

describe('save at >= 10 points of the walkthrough, load with another seed, replay: identical', () => {
  // 0 = before anything; 11 card shown; 16 first upstairs; 35 register; 45 Silas; 55 ledger;
  // 64 accused (Pike fled, arrival pending); 66 mid-flight; 68 Pike arriving; 83 file;
  // 88 tunnel; 89 counter running; 90 Pike cuffed
  const POINTS = [0, 3, 11, 16, 35, 45, 55, 64, 66, 68, 83, 88, 89, 90];
  const ref = reference(WALKTHROUGH, POINTS);

  test('the reference ends in victory at 91', () => {
    assert.equal(ref.final.ended, 'victory');
    assert.equal(ref.final.turn, 91);
  });

  for (const k of POINTS) {
    test(`save after #${k}: SAVE-command data and game.save() both replay identically`, () => {
      const { cmd, api } = ref.saves.get(k);
      assert.deepEqual(JSON.parse(cmd).state, JSON.parse(api).state, 'SAVE 1 carries the same state as game.save()');
      replayAndCompare(ref, WALKTHROUGH, k, cmd, `#${k} (SAVE 1)`);
      replayAndCompare(ref, WALKTHROUGH, k, JSON.parse(api), `#${k} (object)`);
    });
  }

  test('a save is plain JSON and passes validateSave', () => {
    for (const { api } of ref.saves.values()) {
      const r = validateSave(JSON.parse(api), content);
      assert.ok(r.ok, r.error);
    }
  });
});

describe('RNG-heavy stretches survive save/load (beats with chance / pick)', () => {
  test('pyrrhic wait: saves every 30 turns during 210 waits replay the bleed / thunder / flicker picks', () => {
    const script = [...WALKTHROUGH.slice(0, 90), ...times(210, 'wait')];
    const points = [90, 120, 150, 180, 210, 240, 270, 299];
    const ref = reference(script, points);
    assert.equal(ref.final.ended, 'pyrrhic');
    for (const k of points) replayAndCompare(ref, script, k, ref.saves.get(k).cmd, `pyrrhic @${k}`);
  });

  test('fifth stroke from a standing start: saves around Pike leaving (240) and arriving (250)', () => {
    const script = times(300, 'wait');
    const points = [0, 59, 60, 179, 239, 240, 249, 250, 299];
    const ref = reference(script, points);
    assert.equal(ref.final.ended, 'fifth_stroke');
    for (const k of points) replayAndCompare(ref, script, k, ref.saves.get(k).cmd, `wait @${k}`);
  });

  test('boiler route: saves in the mill and in the tunnel', () => {
    const script = [...WALKTHROUGH.slice(0, 83), ...BOILER_ROUTE.map((r) => r.command)];
    const points = [83, 92, 96, 97, 98, 99, 100];
    const ref = reference(script, points);
    assert.equal(ref.final.ended, 'victory');
    for (const k of points) replayAndCompare(ref, script, k, ref.saves.get(k).cmd, `boiler @${k}`);
  });

  test('the same save loaded twice and played on different lines diverges only by input', () => {
    const ref = reference(WALKTHROUGH, [60]);
    const a = otherGame();
    const b = createGame({ content: cloneContent(content), seed: 7, strict: true });
    a.load(ref.saves.get(60).cmd);
    b.load(ref.saves.get(60).cmd);
    for (let k = 0; k < 40; k++) assert.deepEqual(a.input('wait'), b.input('wait'), `wait ${k}`);
    assert.deepEqual(a.snapshot(), b.snapshot());
  });
});

describe('pending questions survive save/load (A3.3, A7.3, A9.3)', () => {
  test('accusation confirmation: save while "Are you certain?" is open, load, YES -> wrong man', () => {
    const g = fresh();
    for (const l of ['n', 'n', 'w']) g.input(l);
    const p = g.input('accuse maggie');
    assert.equal(p.at(-1).type, 'prompt');
    const saved = g.input('save 2').at(-1);
    assert.equal(saved.type, 'storage');
    assert.ok(g.snapshot().ctx.pending, 'SAVE keeps the pending question (A7.3)');
    const refYes = g.input('y');

    const h = otherGame();
    h.start();
    const r = h.load(JSON.stringify(saved.data));
    assert.ok(r.ok, r.error);
    const lastEv = r.events.at(-1);
    assert.equal(lastEv.type, 'prompt', 'refresh bundle ends with the re-emitted prompt');
    assert.equal(lastEv.text, 'Are you certain? (Y/N)');
    assert.deepEqual(h.input('y'), refYes);
    assert.deepEqual(h.snapshot(), g.snapshot());
    assert.equal(h.snapshot().ended, 'wrong_man');
  });

  test('accusation confirmation: load, NO -> cancelled, no turn', () => {
    const g = fresh();
    for (const l of ['n', 'n', 'w', 'accuse maggie']) g.input(l);
    const data = g.save();
    const h = otherGame();
    h.load(data);
    assert.equal(joined(h.input('n')), '(You hold your tongue.)');
    assert.equal(h.snapshot().turn, 3);
    assert.equal(h.snapshot().ctx.pending, null);
  });

  test('disambiguation: "read page" in the car with both pages carried, saved, loaded, answered', () => {
    const g = fresh();
    for (const l of WALKTHROUGH.slice(0, 69)) g.input(l);
    const ask = g.input('read page');
    const prompt = ask.at(-1);
    assert.equal(prompt.type, 'prompt');
    assert.equal(prompt.kind, 'disambig');
    const data = JSON.stringify(g.save());
    const refAnswer = g.input('notebook');

    const h = otherGame();
    const r = h.load(data);
    assert.ok(r.ok, r.error);
    assert.deepEqual(r.events.at(-1), prompt, 'the same question is asked again');
    assert.deepEqual(h.input('notebook'), refAnswer);
    assert.deepEqual(h.snapshot(), g.snapshot());
    assert.ok(h.snapshot().notes.includes('notebook'));
  });

  test('a pending RESTART confirmation is saved and restored too', () => {
    const g = fresh();
    g.input('n');
    g.input('restart');
    assert.equal(g.snapshot().ctx.pending?.kind, 'confirm');
    const h = otherGame();
    assert.ok(h.load(g.save()).ok);
    assert.deepEqual(h.input('no'), g.input('no'));
    assert.deepEqual(h.snapshot(), g.snapshot());
  });
});

describe('saves after an ending (A7.7 E4, A9.3)', () => {
  for (const [name, script, id] of [
    ['victory', WALKTHROUGH, 'victory'],
    ['death_drown', ['n', 'e', 'd', 'e', 'swim', 'swim'], 'death_drown'],
    ['wrong_man', ['n', 'n', 'w', 'accuse maggie', 'y'], 'wrong_man'],
  ]) {
    test(`${name}: the loaded game is ended, re-emits the end event, accepts only UNDO/LOAD/RESTART`, () => {
      const g = fresh();
      let last = [];
      for (const l of script) last = g.input(l);
      const refEnd = endOf(last);
      assert.equal(refEnd.ending, id);
      const data = JSON.stringify(g.save());

      const h = otherGame();
      const r = h.load(data);
      assert.ok(r.ok, r.error);
      const end = endOf(r.events);
      assert.ok(end, 'refresh bundle carries the end event');
      assert.equal(end.ending, id);
      assert.equal(end.score, refEnd.score);
      assert.equal(end.text, refEnd.text);
      assert.equal(r.events.at(-1).type, 'end', 'end is the last event');
      assert.equal(joined(h.input('look')), 'The game is over. Type UNDO, LOAD, RESTART or IMPORT.');
      assert.equal(joined(h.input('undo')), "You can't undo any further.", 'LOAD clears the UNDO snapshot');
      assert.deepEqual(h.snapshot(), g.snapshot());
      h.input('restart');
      assert.equal(h.snapshot().ended, null);
      assert.equal(h.snapshot().turn, 0);
    });
  }
});

describe('invalid saves are rejected atomically (A11 V1-V13)', () => {
  const good = (() => {
    const g = fresh();
    for (const l of WALKTHROUGH.slice(0, 64)) g.input(l);
    return g.save();
  })();
  const corrupt = [
    ['not JSON', '{"format":'],
    ['wrong format', { ...good, format: 'zork' }],
    ['wrong game', { ...good, game: 'other' }],
    ['turn > 300', { ...good, state: { ...good.state, turn: 301 } }],
    ['unknown room', { ...good, state: { ...good.state, roomId: 'attic' } }],
    ['bad var', { ...good, state: { ...good.state, vars: { ...good.state.vars, pikeState: 'dancing' } } }],
    ['negative money', { ...good, state: { ...good.state, money: -1 } }],
    ['extra key', { ...good, state: { ...good.state, extra: 1 } }],
    ['containment cycle', { ...good, state: { ...good.state, items: { ...good.state.items, suitcase: { ...good.state.items.suitcase, loc: 'case_map' }, case_map: { ...good.state.items.case_map, loc: 'suitcase' } } } }],
  ];
  for (const [label, data] of corrupt) {
    test(`${label}: rejected, state and UNDO untouched`, () => {
      const g = fresh();
      for (const l of WALKTHROUGH.slice(0, 20)) g.input(l);
      const before = g.snapshot();
      const r = g.load(data);
      assert.equal(r.ok, false);
      assert.equal(typeof r.error, 'string');
      assert.deepEqual(r.events, []);
      assert.deepEqual(g.snapshot(), before);
      // UNDO still restores the line before #20
      g.input('undo');
      assert.equal(g.snapshot().turn, 19);
    });
  }

  test('the good save still loads after all that', () => {
    const g = otherGame();
    assert.ok(g.load(good).ok);
    assert.equal(snap(g).turn, 64);
  });
});
