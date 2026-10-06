// TT-130 — finale guidance (docs/STORY.md §1.7, §7.3 HARROW_CUFFS, §8.1, §8.4, §10 step 0).
// Both blind testers (docs/playtest/) reached the Counting Room with the cuffs and died trying
// ACCUSE / SHOW / ASK: nothing pointed at HANDCUFF PIKE until the death text. These tests
// replay their exact finale commands and assert that the cuffs are named before the knife.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import content from '../../src/content/index.js';
import { newGame, texts, setup } from '../fixtures/harness.js';

const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');
const WALKTHROUGH = STORY.split('Plain list for `tests/walkthrough/` (91 lines):\n```\n')[1].split('```')[0].trim().split('\n');

const snap = (g) => g.snapshot();
const say = (g, line) => texts(g.input(line)).join('\n');
const CUFFS = /cuff/i;

const SAVES = new Map();
/** Replays `lines` once, then hands out fresh games loaded from that save. */
function from(key, build) {
  if (!SAVES.has(key)) {
    const g = newGame(content);
    g.start();
    build(g);
    SAVES.set(key, g.save());
  }
  const g = newGame(content);
  assert.ok(g.load(structuredClone(SAVES.get(key))).ok);
  return g;
}

/**
 * Tester A, attempt 1: never went to the church or No.13 (no register, no button: two pieces
 * of evidence), never accused Pike at his desk, waited in the tunnel until Pike went down at
 * 23:30, carrying the handcuffs, the crowbar, the ledger page and the file.
 */
const testerA = () => from('A', (g) => {
  const skip = new Set(['take button', 'read register', 'accuse pike']);
  for (const line of WALKTHROUGH.slice(0, 88)) g.input(skip.has(line) ? 'z' : line);
  while (snap(g).vars.pikeState !== 'counting') g.input('z');
});
/** The reference route at §12.1 #88 (Pike accused at his desk, all evidence carried), in the tunnel. */
const tunnel = () => from('ref', (g) => { for (const line of WALKTHROUGH.slice(0, 88)) g.input(line); });

describe('blind finale replays (docs/playtest/tester-A-log.md, tester-B-log.md)', () => {
  test('tester A attempt 1: every command before the knife names the cuffs; death only after the 4th', () => {
    const g = testerA();
    assert.equal(snap(g).roomId, 'tunnel');
    assert.equal(snap(g).items.handcuffs.loc, 'player');
    const turns = [];
    for (const line of ['n', 'accuse pike', 'show file to pike', 'show ledger page to pike']) {
      turns.push(say(g, line));
      assert.equal(snap(g).ended, null, line);
    }
    // "Prove it" (two pieces of evidence) is no longer a dead end: Harrow answers it.
    assert.match(turns[1], /^"Prove it," says Pike/);
    for (const t of turns.slice(1)) assert.match(t, CUFFS);
    assert.match(turns[1], /Don't talk to him, kid - cuff him!/);
    assert.match(turns[2], /Stop talking! The cuffs, kid/);
    assert.match(turns[3], /^He doesn't look at it\./);
    say(g, 'hit pike with crowbar');
    assert.equal(snap(g).ended, 'death_pike');
  });

  test('tester A attempt 1: HANDCUFF PIKE after any of those warnings still wins', () => {
    for (let k = 1; k <= 4; k++) {
      const g = testerA();
      for (const line of ['n', 'accuse pike', 'show file to pike', 'show ledger page to pike'].slice(0, k)) g.input(line);
      say(g, 'handcuff pike');
      assert.equal(snap(g).vars.pikeState, 'restrained', `after ${k} commands`);
      say(g, 'cut chains');
      assert.equal(snap(g).ended, 'victory');
    }
  });

  test('tester B: ACCUSE, SHOW LEDGER PAGE, ASK ABOUT MARY each steer to the cuffs; ARREST works', () => {
    const g = tunnel();
    say(g, 'n');
    const accuse = say(g, 'accuse pike');
    assert.match(accuse, /^You say it out loud/);
    assert.match(accuse, /cuff him! Get the cuffs on him!/);
    assert.match(say(g, 'show ledger page to pike'), CUFFS);
    assert.match(say(g, 'ask pike about mary'), CUFFS);
    assert.equal(snap(g).vars.attack, 4);
    assert.match(say(g, 'arrest pike'), /Click\. Click\./);
  });
});

describe('the Counting Room steers', () => {
  test('ACCUSE with >= 3 evidence awards the accusation down here and gets Harrow\'s shout', () => {
    const g = testerA();
    setup(g, (s) => { s.evidence.push('ev_register'); });
    say(g, 'n');
    const score = snap(g).score;
    const t = say(g, 'accuse pike');
    assert.match(t, /"You forgot one\."/);
    assert.match(t, /Behind him Harrow drags his head up\. "Don't talk to him, kid - cuff him!/);
    assert.equal(snap(g).score, score + 10);
    assert.ok(snap(g).awarded.includes('accusation'));
  });

  test('the shout replaces the counter\'s own cue on the same turn; a bare WAIT gets the cue', () => {
    const g = tunnel();
    say(g, 'n');
    const t = say(g, 'accuse pike');
    assert.equal((t.match(/Harrow/g) ?? []).length, 1, t);
    assert.match(t, /"Two\."$/);
    assert.equal(snap(g).flags.harrow_shouted, undefined, 'cleared at the end of the turn');
    assert.match(say(g, 'wait'), /"Three," says Pike, and takes a step closer\. Behind him Harrow gets the words out at last: "Cuff him, kid! The cuffs!"/);
    assert.match(say(g, 'wait'), /Harrow is shouting now: "The cuffs, kid! NOW!"/);
  });

  test('without the cuffs: every warning points back out, and leaving pauses the count', () => {
    const g = tunnel();
    setup(g, (s) => { s.items.handcuffs.loc = 'tunnel'; });
    say(g, 'n');
    const tackle = say(g, 'tackle pike');
    assert.match(tackle, /With what\? Harrow croaks: 'Cuffs - in my car!'/);
    assert.match(tackle, /Harrow, hoarse: "No cuffs\? Then get out, kid!"/);
    assert.match(say(g, 'accuse pike'), /Cuffs - mine are in the car, moor road\. Get out and get them!/);
    assert.match(say(g, 'hint'), /^You've nothing to hold him with\. Go SOUTH/);
    say(g, 's');
    assert.equal(snap(g).ended, null);
    say(g, 'take cuffs');
    say(g, 'n');
    assert.match(say(g, 'subdue pike'), /Click\. Click\./);
  });

  test('SHOW / GIVE / TELL / TALK down here: no desk replies, Harrow steers', () => {
    const g = tunnel();
    say(g, 'n');
    assert.match(say(g, 'show cuffs to pike'), /I keep my own book, Sergeant\."\n.*cuff/);
    assert.match(say(g, 'talk to pike'), CUFFS);
    say(g, 'arrest pike');
    assert.equal(say(g, 'show file to pike'), 'He does not look up. He is counting the links of the cuffs.');
    assert.doesNotMatch(say(g, 'ask pike about mary'), /Harrow/);
  });

  test('ASK / TELL HARROW while Pike counts: "Not now, kid!"; afterwards his topics are back', () => {
    const g = tunnel();
    say(g, 'n');
    assert.equal(say(g, 'ask harrow about the door').split('\n')[0], '"Not now, kid! He\'s got a knife - get the cuffs on him!"');
    say(g, 'cuff pike');
    assert.equal(say(g, 'ask harrow about cuffs'), '"Then use them!"');
  });

  test('arrest synonyms: SUBDUE, TACKLE, APPREHEND, DISARM, OVERPOWER, NICK, CUFF, HANDCUFF, RESTRAIN', () => {
    for (const verb of ['subdue', 'tackle', 'apprehend', 'disarm', 'overpower', 'nick', 'cuff', 'handcuff', 'restrain', 'arrest']) {
      const g = tunnel();
      say(g, 'n');
      say(g, `${verb} pike`);
      assert.equal(snap(g).vars.pikeState, 'restrained', verb);
    }
  });

  test('HINT in the Counting Room is explicit whatever earlier steps are undone', () => {
    const g = testerA(); // register and button never found: steps 6-7 are not done
    say(g, 'n');
    assert.equal(say(g, 'hint'), 'No more talking. HANDCUFF PIKE, now. Then CUT CHAINS to get Frank down.');
    say(g, 'cut chains');
    assert.equal(say(g, 'hint'), 'No more talking. HANDCUFF PIKE, now.');
    const h = testerA();
    say(h, 'n');
    say(h, 'cuff pike');
    assert.equal(say(h, 'hint'), 'Pike is cuffed. CUT CHAINS to get Frank down.');
    setup(h, (s) => { s.items.bolt_cutters.loc = 'tunnel'; });
    assert.match(say(h, 'hint'), /^Pike is cuffed\. Frank's chains want cutters/);
  });

  test('HELP names ARREST and HANDCUFF alongside ACCUSE', () => {
    const g = newGame(content);
    g.start();
    const help = say(g, 'help');
    assert.match(help, /ACCUSE them/);
    assert.match(help, /ARREST or HANDCUFF them, and you'll need cuffs/);
  });
});
