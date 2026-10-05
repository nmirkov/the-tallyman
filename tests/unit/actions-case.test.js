// TT-009 — case mechanics: ACCUSE (PLAN §2.5, ARCHITECTURE A4.13, A7.3, A7.4, A14 rules
// 2–5), evidence counting and NOTES (A8.8), HINT (A8.11) on the mini-world / case-world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, RULE_DEFAULTS } from '../../src/engine/types.js';
import { messages as caseMsg } from '../../src/engine/actions/case.js';
import mini from '../fixtures/mini-world.js';
import caseWorld from '../fixtures/case-world.js';
import {
  newGame, cloneContent, texts, types, setup, last,
} from '../fixtures/harness.js';

const at = (g, roomId, extra = () => {}) => setup(g, (s) => {
  s.roomId = roomId;
  if (!s.visited.includes(roomId)) s.visited.push(roomId);
  extra(s);
});
const snap = (g) => g.snapshot();
const say = (g, line) => texts(g.input(line));
const variant = (base, mutate) => {
  const c = cloneContent(base);
  mutate(c);
  return newGame(c);
};
/** Gives the player discovered item evidence (carried) and / or facts. */
const withEvidence = (s, { items = [], facts = [] }) => {
  const byItem = { ledger_page: 'ev_ledger', button: 'ev_button' };
  for (const id of items) {
    s.items[id].loc = 'player';
    s.evidence.push(byItem[id]);
  }
  for (const id of facts) s.evidence.push(id);
};

/* ------------------------------------------------------------------------ *
 *  ACCUSE — §2.5 rule: free only when it does not resolve                   *
 * ------------------------------------------------------------------------ */

test('ACCUSE someone not present: "Accuse who? They\'re not here." — free, chain stops', () => {
  const g = newGame();
  const ev = g.input('accuse pike. wait');
  assert.deepEqual(texts(ev), ['Accuse who? They\'re not here.', '(Commands after ACCUSE were ignored.)']);
  assert.equal(ev[0].style, 'system');
  assert.equal(snap(g).turn, 0);
  assert.deepEqual(say(g, 'charge maggie'), ['Accuse who? They\'re not here.'], 'suspects too');
  assert.equal(snap(g).turn, 0);
  assert.equal(snap(g).ctx.pending, null);
});

/* ------------------------------------------------------------------------ *
 *  Culprit, evidence ≥ threshold → correct                                  *
 * ------------------------------------------------------------------------ */

test('culprit with evidence ≥ threshold → `correct` (+10, flees, arrival turn), 1 turn, no prompt', () => {
  const g = newGame();
  at(g, 'office', (s) => { s.turn = 10; withEvidence(s, { items: ['ledger_page', 'button'] }); });
  const ev = g.input('accuse pike');
  assert.ok(!ev.some((e) => e.type === 'prompt'));
  assert.deepEqual(texts(ev), ['Pike shoves past you and is gone.', '[Your score has gone up by 10 points.]']);
  const s = snap(g);
  assert.equal(s.turn, 11);
  assert.equal(s.npcs.pike.loc, null);
  assert.equal(s.vars.pikeState, 'fled');
  assert.equal(s.vars.arrivalTurn, 15, 'turnPlus counts from the turn of the action');
  assert.deepEqual(s.awarded, ['accusation']);
});

test('a fact counts once noted; item evidence counts while carried (also inside a carried bag)', () => {
  const g = newGame();
  at(g, 'office', (s) => {
    withEvidence(s, { facts: ['ev_register'] });
    s.items.satchel.loc = 'player';
    s.items.satchel.open = true;
    s.items.ledger_page.loc = 'satchel';
    s.evidence.push('ev_ledger');
  });
  assert.deepEqual(say(g, 'accuse pike')[0], 'Pike shoves past you and is gone.');
});

test('evidence exactly at the threshold is enough; the award is once-only', () => {
  const g = variant(mini, (c) => { c.case.correct = { award: 'accusation', say: 'Got you.' }; });
  at(g, 'office', (s) => withEvidence(s, { items: ['ledger_page'], facts: ['ev_register'] }));
  assert.deepEqual(say(g, 'accuse pike'), ['Got you.', '[Your score has gone up by 10 points.]']);
  assert.deepEqual(say(g, 'accuse pike'), ['Got you.'], 'second correct accusation: points only once');
});

test('`correct` as cases: the first matching case runs (A14 encoding: Police House vs elsewhere)', () => {
  const g = variant(mini, (c) => {
    c.case.correct = [
      { if: { in: 'office' }, say: 'He bolts.', setVar: { pikeState: 'fled' } },
      { award: 'accusation', say: 'Points only.' },
    ];
  });
  at(g, 'cellar', (s) => { s.npcs.pike.loc = 'cellar'; s.items.torch.loc = 'player'; s.items.torch.lit = true; withEvidence(s, { items: ['ledger_page', 'button'] }); });
  assert.deepEqual(say(g, 'accuse pike'), ['Points only.', '[Your score has gone up by 10 points.]']);
  assert.equal(snap(g).vars.pikeState, 'desk');
});

/* ------------------------------------------------------------------------ *
 *  Culprit, evidence < threshold → weak, may retry                          *
 * ------------------------------------------------------------------------ */

test('culprit with evidence < threshold → `weak` (laughs, nerve +15), 1 turn, may retry', () => {
  const g = newGame();
  at(g, 'office', (s) => withEvidence(s, { items: ['ledger_page'] }));
  const n0 = snap(g).nerve;
  assert.deepEqual(say(g, 'accuse pike'), ['Pike laughs in your face.']);
  assert.equal(snap(g).nerve, n0 + 15 - 1);   // D6 (TT-010): the lit office also gives −1 per turn
  assert.equal(snap(g).turn, 1);
  assert.deepEqual(say(g, 'accuse sergeant'), ['Pike laughs in your face.']);
  assert.equal(snap(g).nerve, n0 + 30 - 2);
  assert.equal(snap(g).npcs.pike.loc, 'office');
  assert.deepEqual(snap(g).awarded, []);
});

test('dropping an evidence item lowers the count; picking it up restores it', () => {
  const g = newGame();
  at(g, 'office', (s) => withEvidence(s, { items: ['ledger_page', 'button'] }));
  g.input('drop button');
  assert.deepEqual(say(g, 'accuse pike'), ['Pike laughs in your face.']);
  g.input('take button');
  assert.deepEqual(say(g, 'accuse pike')[0], 'Pike shoves past you and is gone.');
});

/* ------------------------------------------------------------------------ *
 *  Suspects → confirmation (free); YES ends; NO / anything else cancels     *
 * ------------------------------------------------------------------------ */

test('suspect → "Are you certain? (Y/N)" prompt: free, last event, pending stored', () => {
  const g = newGame();
  at(g, 'pub');
  const ev = g.input('accuse maggie');
  assert.deepEqual(last(ev), { type: 'prompt', kind: 'confirm', text: 'Are you certain? (Y/N)' });
  assert.equal(ev.length, 1);
  assert.equal(snap(g).turn, 0);
  assert.deepEqual(snap(g).ctx.pending, {
    kind: 'confirm', text: 'Are you certain? (Y/N)',
    command: { verb: 'accuse', verbWord: 'accuse', dobj: 'maggie', raw: 'accuse maggie' },
  });
});

test('YES → `wrong` (Wrong man ending), costs 1 turn; Y works too', () => {
  for (const answer of ['yes', 'y', 'YES']) {
    const g = newGame();
    at(g, 'pub');
    g.input('accuse maggie');
    const ev = g.input(answer);
    assert.equal(last(ev).type, 'end', answer);
    assert.equal(last(ev).ending, 'wrong_man');
    assert.equal(last(ev).kind, 'wrong');
    assert.equal(snap(g).turn, 1);
    assert.equal(snap(g).ctx.pending, null);
  }
});

test('NO / N → "(Cancelled.)", no turn, chain stops; evidence does not matter for suspects', () => {
  for (const answer of ['no', 'n']) {
    const g = newGame();
    at(g, 'pub', (s) => withEvidence(s, { items: ['ledger_page', 'button'] }));
    g.input('accuse maggie');
    const ev = g.input(`${answer}. wait`);
    assert.deepEqual(texts(ev), [MESSAGES.confirmCancelled, '(Commands after ' + answer.toUpperCase() + ' were ignored.)']);
    assert.equal(ev[0].style, 'system');
    assert.equal(snap(g).turn, 0);
    assert.equal(snap(g).ctx.pending, null);
    assert.equal(snap(g).roomId, 'pub', 'N means NO, not north, while a confirm is open');
  }
});

test('anything else cancels (free) and then runs as a new command at its own cost', () => {
  const g = newGame();
  at(g, 'pub');
  g.input('accuse maggie');
  const ev = g.input('s');
  assert.equal(texts(ev)[0], MESSAGES.confirmCancelled);
  assert.equal(snap(g).roomId, 'square');
  assert.equal(snap(g).turn, 1);
  assert.equal(snap(g).ended, null);
});

test('content cancelText is said (prose) on NO and on anything else; content confirm Text', () => {
  const g = variant(caseWorld, (c) => {
    c.case.confirm = [{ if: { present: 'silas' }, text: 'Silas? Are you sure? (Y/N)' }, { text: 'Are you certain? (Y/N)' }];
  });
  at(g, 'alley');
  assert.equal(last(g.input('accuse silas')).text, 'Silas? Are you sure? (Y/N)');
  const ev = g.input('no');
  assert.deepEqual(ev, [{ type: 'text', text: 'You think better of it.' }]);
  g.input('accuse old man');
  assert.deepEqual(texts(g.input('wait')), ['You think better of it.', 'Time passes.']);
  assert.equal(snap(g).turn, 1);
});

test('missing / empty confirm text falls back to accuseConfirm', () => {
  const g = variant(mini, (c) => { c.case.confirm = [{ if: 'never_set', text: 'x' }]; });
  at(g, 'pub');
  assert.equal(last(g.input('accuse maggie')).text, caseMsg.accuseConfirm);
});

test('the confirmation survives SAVE / LOAD; UNDO after the ending; cancelled accusations are not repeated by AGAIN', () => {
  const g = newGame();
  at(g, 'pub');
  g.input('accuse maggie');
  const data = g.save();
  const g2 = newGame();
  const r = g2.load(data);
  assert.equal(last(r.events).type, 'prompt');
  assert.equal(last(g2.input('yes')).ending, 'wrong_man');
  assert.deepEqual(texts(g2.input('look')), [MESSAGES.gameOver]);
  g2.input('undo');
  assert.equal(snap(g2).ended, null);

  const g3 = newGame();
  at(g3, 'pub');
  g3.input('accuse maggie');
  g3.input('no');
  g3.input('wait');
  assert.deepEqual(say(g3, 'again'), ['Time passes.']);
  g3.input('accuse maggie');
  g3.input('look');
  assert.equal(last(g3.input('g')).type, 'status', 'AGAIN repeats LOOK, not the cancelled accusation');
  g3.input('accuse maggie');
  g3.input('n');
  assert.equal(snap(g3).ctx.lastCommand.verb, 'look', 'a cancelled confirmation is not lastCommand');
});

test('the culprit wins over the suspects list (no confirmation for the culprit)', () => {
  const g = variant(mini, (c) => { c.case.suspects = ['maggie', 'pike']; });
  at(g, 'office');
  assert.deepEqual(say(g, 'accuse pike'), ['Pike laughs in your face.']);
});

test('case hooks get phase "case", the command and self = the accused', () => {
  const seen = [];
  const g = variant(mini, (c) => {
    c.case.weak = { hook: 'weak_hook' };
    c.hooks.weak_hook = (api, args) => { seen.push([args.phase, args.self, args.cmd.verb, api.evidenceCount()]); api.say('Hmm.'); };
  });
  at(g, 'office');
  assert.deepEqual(say(g, 'accuse pike'), ['Hmm.']);
  assert.deepEqual(seen, [['case', 'pike', 'accuse', 0]]);
});

/* ------------------------------------------------------------------------ *
 *  Others: non-suspect NPCs, things, yourself, no case                      *
 * ------------------------------------------------------------------------ */

test('a non-suspect NPC → `case.other`, else accuseOther; 1 turn, no prompt', () => {
  const g = newGame(caseWorld);
  assert.deepEqual(say(g, 'accuse constable'), ['"Me? I only walk the beat," says the constable.']);
  const g2 = variant(caseWorld, (c) => { delete c.case.other; });
  assert.deepEqual(say(g2, 'accuse the constable'), ['You have nothing to pin on the constable.']);
  assert.equal(snap(g2).turn, 1);
});

test('ACCUSE a thing, yourself, or with no case defined: in-world refusals (1 turn)', () => {
  const g = newGame();
  assert.deepEqual(say(g, 'accuse fountain'), [caseMsg.accuseThing]);
  assert.deepEqual(say(g, 'accuse myself'), [caseMsg.accuseSelf]);
  assert.equal(snap(g).turn, 2);
  const g2 = variant(mini, (c) => { delete c.case; });
  at(g2, 'pub');
  assert.deepEqual(say(g2, 'accuse maggie'), [caseMsg.accuseNoCase], 'no case: no prompt either');
});

test('NPC before.accuse slots run before the handler (and can handle it)', () => {
  const g = variant(mini, (c) => { c.npcs.pike.before.accuse = { if: { var: 'pikeState', eq: 'restrained' }, say: 'He is already in cuffs.' }; });
  at(g, 'office', (s) => { s.vars.pikeState = 'restrained'; });
  assert.deepEqual(say(g, 'accuse pike'), ['He is already in cuffs.']);
});

/* ------------------------------------------------------------------------ *
 *  NOTES (A8.8)                                                             *
 * ------------------------------------------------------------------------ */

test('NOTES: empty notebook; free', () => {
  const g = newGame();
  assert.deepEqual(g.input('notes'), [{ type: 'text', text: caseMsg.notesEmpty }]);
  assert.equal(snap(g).turn, 0);
});

test('NOTES lists notes in order noted, then evidence labels with the current count', () => {
  const g = newGame();
  at(g, 'office');
  g.input('read register');
  assert.deepEqual(say(g, 'notebook'), [
    'Your notebook:\n  Duty register: Pike signed out at the time Harrow vanished.',
    'Evidence (1):\n  Duty register entry',
  ]);
  at(g, 'back_room', (s) => { s.items.crate.open = true; s.items.jar.open = true; });
  g.input('take page');
  g.input('take button');
  g.input('drop page');
  assert.deepEqual(say(g, 'clues')[1], 'Evidence (2):\n  Duty register entry\n  Ledger page (1912) (not with you)\n  Silver tunic button');
  assert.equal(snap(g).turn, 4, 'NOTES is free');
});

test('NOTES wording is overridable through content.messages', () => {
  const g = variant(mini, (c) => { c.messages = { ...c.messages, evidenceHeader: 'Exhibits [{n}]', notesLine: '* {text}', notWithYou: '{label} - left behind' }; });
  at(g, 'office', (s) => { s.evidence.push('ev_ledger'); });
  assert.deepEqual(say(g, 'notes'), ['Exhibits [0]\n* Ledger page (1912) - left behind']);
});

/* ------------------------------------------------------------------------ *
 *  HINT (A8.11)                                                             *
 * ------------------------------------------------------------------------ */

test('HINT: first open step, tiers advance and stop at the last; costs hintCost points; status; free', () => {
  const g = newGame();
  setup(g, (s) => { s.score = 10; });
  const ev = g.input('hint');
  assert.deepEqual(texts(ev), ['It is dark below the town.']);
  assert.equal(last(ev).type, 'status');
  assert.equal(last(ev).score, 8);
  assert.deepEqual(say(g, 'hints'), ['Pike keeps a torch in the office.']);
  assert.deepEqual(say(g, 'hint'), ['TURN ON TORCH.']);
  assert.deepEqual(say(g, 'hint'), ['TURN ON TORCH.'], 'stays on the last tier');
  const s = snap(g);
  assert.deepEqual(s.hintTiers, { light: 2 });
  assert.equal(s.score, 2);
  assert.equal(s.turn, 0);
});

test('HINT: score never goes below 0; a done step is skipped; default hintCost', () => {
  const g = newGame();
  setup(g, (s) => { s.score = 1; });
  g.input('hint');
  assert.equal(snap(g).score, 0);
  g.input('hint');
  assert.equal(snap(g).score, 0);
  setup(g, (s) => { s.awarded.push('torch_lit'); });
  assert.deepEqual(say(g, 'hint'), ['The pub keeps its secrets in the back.']);

  const g2 = variant(mini, (c) => { delete c.scoring.hintCost; });
  setup(g2, (s) => { s.score = 20; });
  g2.input('hint');
  assert.equal(snap(g2).score, 20 - RULE_DEFAULTS.hintCost);
});

test('HINT with every step done (or no hints): hintDone, no cost, no status', () => {
  const g = newGame();
  setup(g, (s) => { s.score = 10; s.awarded.push('torch_lit'); s.evidence.push('ev_ledger'); });
  const ev = g.input('hint');
  assert.deepEqual(ev, [{ type: 'text', text: caseMsg.hintDone }]);
  assert.equal(snap(g).score, 10);
  const g2 = variant(mini, (c) => { delete c.hints; });
  assert.deepEqual(say(g2, 'hint'), [caseMsg.hintDone]);
});

test('HINT state survives SAVE / LOAD; a later step continues after an earlier one is done', () => {
  const g = newGame(caseWorld);
  setup(g, (s) => { s.awarded.push('torch_lit'); s.evidence.push('ev_ledger'); });
  assert.deepEqual(say(g, 'hint'), ['Someone in the office counts everything twice.']);
  const data = g.save();
  const g2 = newGame(caseWorld);
  g2.load(data);
  assert.deepEqual(say(g2, 'hint'), ['ACCUSE PIKE.']);
});

test('meta verbs NOTES and HINT do not stop a chain and never start a turn', () => {
  const g = newGame();
  const ev = g.input('notes. hint. wait');
  assert.deepEqual(types(ev).filter((t) => t === 'status').length, 2, 'one after HINT, one after WAIT');
  assert.equal(snap(g).turn, 1);
});
