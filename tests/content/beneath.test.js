// TT-018 — the real content, Beneath (docs/STORY.md §4.6, §3.3, §6.3, §6.6, §7.2 steps 27-29,
// §7.4, §8.1-8.5, §9, §10): the tunnel and the iron door before / after Pike arrives, the
// Counting Room (greeting, re-entry, bleeding cues), every finale phrasing, Pike's and
// Harrow's finale voices, the dark warning and the last hint steps. The endings themselves
// are walked end to end in walkthrough-smoke.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import content from '../../src/content/index.js';
import { newGame, texts, setup } from '../fixtures/harness.js';

const STORY = readFileSync(new URL('../../docs/STORY.md', import.meta.url), 'utf8');
/** STORY §12.1 "Plain list for tests/walkthrough/" (91 commands). */
const WALKTHROUGH = STORY.split('Plain list for `tests/walkthrough/` (91 lines):\n```\n')[1].split('```')[0].trim().split('\n');

const snap = (g) => g.snapshot();
const say = (g, line) => texts(g.input(line)).join('\n');
const sfx = (ev, id) => ev.some((e) => e.type === 'sfx' && e.id === id);

/** Saves after the first `k` walkthrough commands, replayed once per k. */
const SAVES = new Map();
function after(k) {
  if (!SAVES.has(k)) {
    const g = newGame(content);
    g.start();
    for (const line of WALKTHROUGH.slice(0, k)) g.input(line);
    SAVES.set(k, g.save());
  }
  const g = newGame(content);
  const r = g.load(structuredClone(SAVES.get(k)));
  assert.ok(r.ok, r.error);
  return g;
}
/** In the tunnel after §12.1 #88 (turn 88; Pike counting since turn 68; everything carried). */
const inTunnel = () => after(88);
/** In the Counting Room after §12.1 #89 (greeted; attack 1). */
const inCountingRoom = () => after(89);

/** The tunnel, lit, before Pike has gone down (he is still at his desk). */
function tunnelBeforePike(extra = () => {}) {
  const g = inTunnel();
  setup(g, (s) => {
    s.vars.pikeState = 'desk';
    s.vars.pikeArrivalTurn = null;
    s.npcs.pike.loc = 'police_house';
    extra(s);
  });
  return g;
}

/* ------------------------------------------------------------------------ *
 *  Bundle                                                                   *
 * ------------------------------------------------------------------------ */

describe('bundle', () => {
  test('Beneath has the tunnel and the Counting Room, both dark; STORY\'s 42 rooms; no stubs', () => {
    const beneath = Object.keys(content.rooms).filter((id) => content.rooms[id].zone === 'beneath');
    assert.deepEqual(beneath, ['tunnel', 'counting_room']);
    for (const id of beneath) assert.equal(content.rooms[id].dark, true, id);
    assert.equal(content.rooms.tunnel.nerve, 2);
    assert.equal(content.rooms.counting_room.nerve, 3);
    assert.equal(content.rooms.counting_room.ambient, 'counting');
    assert.equal(Object.keys(content.rooms).length, 42);
    assert.equal(content.stubs, undefined);
  });

  test('everything that waited for these rooms is live', () => {
    assert.equal(content.items.chains.location, 'counting_room');
    assert.equal(content.items.chains.scenery, true);
    assert.deepEqual(content.items.boiler_hatch.alsoIn, ['tunnel']);
    assert.equal(content.npcs.harrow.location, 'counting_room');
    assert.deepEqual(content.daemons.map((d) => d.id), ['pike_arrives', 'attack']);
    assert.ok(content.beats.some((b) => b.id === 'harrow_bleeds'));
    assert.deepEqual(content.hints.map((h) => h.id), ['light', 'room', 'silas', 'mill', 'ledger', 'register', 'button', 'cuffs', 'files', 'accuse', 'way_down', 'door', 'arrest', 'free']);
    assert.equal(content.case.weak[0].if.in, 'counting_room');
    assert.ok(content.items.torch.before.turn_off);
    assert.ok(content.npcs.pike.before.ask && content.npcs.pike.before.tell && content.npcs.pike.before.talk);
    assert.deepEqual(content.beats.find((b) => b.id === 'counting_dark').when.in, ['crypt', 'weaving_shed', 'boiler_room', 'ward', 'morgue', 'tunnel']);
  });
});

/* ------------------------------------------------------------------------ *
 *  The tunnel and the iron door (STORY §4.6, §8.3, §8.5)                     *
 * ------------------------------------------------------------------------ */

describe('the iron door before Pike goes down', () => {
  test('barred: desc, NORTH (msg F), EXAMINE DOOR', () => {
    const g = tunnelBeforePike();
    assert.match(say(g, 'look'), /North, an iron door, shut\. Behind it, very faint, a man is praying\./);
    assert.equal(say(g, 'n'), 'The iron door is barred from the other side. Beyond it, Harrow is praying.');
    assert.equal(snap(g).roomId, 'tunnel');
    assert.match(say(g, 'x door'), /^Iron, studded, shut fast\. It is barred on the far side/);
    assert.equal(say(g, 'x beam'), say(g, 'x iron door'));
  });

  test('KNOCK: Harrow answers (flag heard_harrow)', () => {
    const g = tunnelBeforePike();
    for (const line of ['knock', 'knock on door', 'bang on door', 'rap at door']) {
      assert.match(say(g, line), /^Harrow stops praying\. "Kid\? Is that you\? The bar's on this side/, line);
    }
    assert.equal(snap(g).flags.heard_harrow, true);
  });

  test('after 23:00 the praying slows and Harrow coughs as you come down', () => {
    const g = tunnelBeforePike((s) => { s.turn = 185; });
    assert.match(say(g, 'look'), /North, an iron door, shut\. Behind it Harrow is praying, slower now\./);
    assert.equal(say(g, 'n'), 'The iron door is barred from the other side. Beyond it, Harrow is praying - slower now, losing his place.');
    say(g, 's');
    const t = say(g, 'd');
    assert.equal(snap(g).roomId, 'tunnel');
    assert.match(t, /Beyond the iron door Harrow coughs - a wet, bad cough - and goes quiet for too long\./);
  });

  test('the first entry starts the dread music, once', () => {
    const g = after(87);
    let ev = g.input('d');
    assert.ok(ev.some((e) => e.type === 'music' && e.id === 'dread'));
    assert.equal(snap(g).flags.tunnel_music, true);
    g.input('s');
    ev = g.input('d');
    assert.ok(!ev.some((e) => e.type === 'music' && e.id === 'dread'));
  });

  test('the cough also starts the music when it is the first entry', () => {
    const g = after(87);
    setup(g, (s) => { s.turn = 200; });
    const ev = g.input('d');
    assert.match(texts(ev).join('\n'), /Harrow coughs - a wet, bad cough/);
    assert.ok(ev.some((e) => e.type === 'music' && e.id === 'dread'));
  });

  test('the ladder goes up through the boiler hatch, a door that must be open', () => {
    const g = tunnelBeforePike();
    assert.equal(say(g, 'x ladder'), 'Iron rungs up to the boiler hatch.');
    assert.equal(say(g, 'u'), 'The hatch is closed.');
    assert.equal(say(g, 'open hatch'), 'You heave. Nothing. Rust has welded the rim to the frame. It wants oil.');
    say(g, 'oil hatch');
    say(g, 'open hatch');
    assert.match(say(g, 'u'), /^Boiler Room\n/);
    assert.equal(say(g, 'x steps'), 'Stone steps up to the yard, and the lamp.', 'each room has its own steps (TT-105)');
    assert.match(say(g, 'd'), /^Tunnel\n/);
    assert.equal(say(g, 'x steps'), 'Up to the morgue.');
    assert.match(say(g, 'x marks'), /^Gates of five every few yards/);
    assert.match(say(g, 'x bricks'), /^Victorian brick, sweating\./);
  });
});

describe('Pike goes down', () => {
  test('heard from the tunnel: the beam scrapes, the door stands ajar (sfx door)', () => {
    const g = tunnelBeforePike((s) => { s.vars.pikeState = 'left'; s.npcs.pike.loc = null; s.vars.pikeArrivalTurn = s.turn + 1; });
    const ev = g.input('wait');
    assert.ok(sfx(ev, 'door'));
    assert.match(texts(ev).join('\n'), /Beyond the iron door a beam scrapes and thuds against brick\./);
    assert.equal(snap(g).vars.pikeState, 'counting');
    assert.match(say(g, 'look'), /North, the iron door stands ajar - the bar lifted from inside by someone who wants a way out\./);
    assert.match(say(g, 'x door'), /^Iron, studded, ajar\./);
    assert.equal(say(g, 'knock'), 'The door swings at your knock. It is not barred any more.');
  });

  test('heard from the counting house: the trap shudders (sfx hatch); then it is bolted from beneath', () => {
    const g = after(54);
    setup(g, (s) => { s.vars.pikeState = 'fled'; s.npcs.pike.loc = null; s.vars.pikeArrivalTurn = s.turn + 1; });
    const ev = g.input('wait');
    assert.ok(sfx(ev, 'hatch'));
    assert.match(texts(ev).join('\n'), /Under your feet the iron trap shudders\./);
    assert.match(say(g, 'look'), /The iron trap in the floor has lost its padlock; it is bolted from beneath\./);
    assert.equal(say(g, 'x trap'), "The iron trap, its padlock gone. Bolted from beneath. Pike's door is shut behind him.");
    assert.equal(say(g, 'open trap'), 'Bolted from beneath. It does not give a fraction.');
  });

  test('in the dark the open door still refuses you (A8.3 darkness answers before msg F)', () => {
    // Msg F's first variant ("Into a room with Pike in it, in the dark?") is transcribed
    // but unreachable: with the torch off the tunnel is dark, so the darkness rule
    // refuses every exit but the way back before the exit's own `if` is consulted.
    const g = inTunnel();
    say(g, 'turn off torch');
    assert.equal(say(g, 'n'), 'You blunder about in the dark but find no way through.');
    assert.equal(snap(g).roomId, 'tunnel');
    say(g, 'turn on torch');
    assert.match(say(g, 'n'), /^The Counting Room\n/);
  });
});

/* ------------------------------------------------------------------------ *
 *  The Counting Room (STORY §4.6, §8.4, §8.5)                                *
 * ------------------------------------------------------------------------ */

describe('the Counting Room', () => {
  test('entering: the greeting once (sfx sting, flag pike_greeted), attack 1', () => {
    const g = inTunnel();
    const ev = g.input('n');
    assert.ok(sfx(ev, 'sting'));
    const t = texts(ev).join('\n');
    assert.match(t, /Harrow hangs in chains beneath them\. The iron door is south\./);
    assert.match(t, /Arthur Pike stands between you and Harrow, a long knife held low, counting under his breath\./);
    assert.match(t, /DI Frank Harrow hangs in chains from the wall, his shirt dark at the side\./);
    assert.match(t, /^Pike turns from the wall\./m);
    assert.doesNotMatch(t, /Harrow's head has dropped/);
    assert.equal(snap(g).flags.pike_greeted, true);
    assert.equal(snap(g).vars.attack, 1);
  });

  test('leaving pauses the counter; re-entry says he is waiting and adds 1', () => {
    const g = inCountingRoom();
    say(g, 's');
    say(g, 'wait');
    assert.equal(snap(g).vars.attack, 1);
    const t = say(g, 'n');
    assert.match(t, /Pike is waiting for you, knife low\. He has started counting again\./);
    assert.doesNotMatch(t, /Pike turns from the wall/);
    assert.match(t, /He circles, knife low\./);
    assert.equal(snap(g).vars.attack, 2);
  });

  test('after 23:00 the bleeding cue follows the greeting', () => {
    const g = inTunnel();
    setup(g, (s) => { s.turn = 190; });
    const t = say(g, 'n');
    assert.match(t, /"I've one more to count\."\nHarrow's head has dropped\. When he lifts it, it takes him a long time\./);
  });

  test('the bleeding cue on entry once Pike is cuffed, too', () => {
    const g = inCountingRoom();
    say(g, 'arrest pike');
    say(g, 's');
    setup(g, (s) => { s.turn = 200; });
    const t = say(g, 'n');
    assert.match(t, /^Harrow's head has dropped\./m);
    assert.doesNotMatch(t, /Pike is waiting for you/);
    assert.match(t, /Arthur Pike kneels by the wall in Harrow's handcuffs, lips moving\./);
  });

  test('scenery', () => {
    const g = inCountingRoom();
    say(g, 'arrest pike'); // stops the counter so we can look around
    assert.match(say(g, 'x table'), /^A long table where the wages were counted out in 1912\./);
    assert.equal(say(g, 'x rings'), 'Iron rings set in the brick. Harrow is chained to two of them.');
    assert.match(say(g, 'x strokes'), /^Four strokes, each as long as a man/);
    assert.equal(say(g, 'x wall'), say(g, 'x strokes'));
    assert.match(say(g, 'x trap'), /^Iron rungs climb to a trap in the ceiling - the counting house above\./);
    assert.equal(say(g, 'x beam'), 'The bar that held the iron door, leaned against the wall. Pike lifted it when he came down. His way out.');
    assert.equal(say(g, 'x chains'), "Heavy chain from Harrow's wrists to two rings in the wall, padlocked. Cutters would do it.");
    assert.equal(say(g, 'pull chains'), 'Set in the brick. They will not pull out.');
  });
});

/* ------------------------------------------------------------------------ *
 *  STORY §7.2 steps 27-29: every accepted phrasing                           *
 * ------------------------------------------------------------------------ */

describe('STORY §7.2 finale phrasings', () => {
  for (const line of ['n', 'go north', 'north']) {
    test(`27. ${line}`, () => {
      const g = inTunnel();
      say(g, line);
      assert.equal(snap(g).roomId, 'counting_room');
    });
  }
  const arrest = ['arrest pike', 'cuff pike', 'handcuff pike', 'restrain pike', 'arrest pike with handcuffs', 'use handcuffs', 'use handcuffs on pike', 'put handcuffs on pike', 'cuff arthur'];
  for (const line of arrest) {
    test(`28. ${line}`, () => {
      const g = inCountingRoom();
      const ev = g.input(line);
      assert.ok(sfx(ev, 'chain'));
      assert.equal(snap(g).vars.pikeState, 'restrained');
      assert.ok(snap(g).awarded.includes('arrest'));
      assert.equal(snap(g).score, 90);
      assert.equal(snap(g).vars.attack, 1, 'the counter stops in the same turn');
    });
  }
  const free = ['cut chains', 'cut chains with cutters', 'free harrow', 'release harrow', 'unchain harrow', 'rescue harrow', 'cut harrow free', 'cut harrow', 'break chains', 'use cutters', 'use cutters on chains', 'unshackle frank', 'crop chains', 'open chains'];
  for (const line of free) {
    test(`29. ${line}`, () => {
      const g = inCountingRoom();
      const ev = g.input(line);
      assert.ok(sfx(ev, 'chain'));
      assert.equal(snap(g).vars.harrowFreed, true);
      assert.ok(snap(g).awarded.includes('harrow_freed'));
      assert.match(texts(ev).join('\n'), /"Behind you!" he says\./);
    });
  }
});

/* ------------------------------------------------------------------------ *
 *  Refusals, voices, the dark warning                                        *
 * ------------------------------------------------------------------------ */

describe('finale refusals and voices', () => {
  test('arrest and cut twice: "He is going nowhere." / "Already cut."', () => {
    const g = inCountingRoom();
    say(g, 'arrest pike');
    say(g, 'cut chains');
    assert.equal(snap(g).ended, 'victory');
    g.input('undo');
    assert.equal(say(g, 'arrest pike'), 'He is going nowhere. He is counting the links of the cuffs.');
  });

  test('cutting without the cutters', () => {
    const g = inCountingRoom();
    setup(g, (s) => { s.items.bolt_cutters.loc = 'tunnel'; });
    assert.equal(say(g, 'cut chains').split('\n')[0], "They're padlocked to the rings. You'll need cutters.");
    assert.equal(snap(g).vars.harrowFreed, false);
  });

  test('Pike in the Counting Room: his voice for ASK / TELL / TALK; ATTACK refused', () => {
    const g = inCountingRoom();
    const voice = ['"Four," he says, not to you. "Four, and one to settle."', '"She was fourteen, Sergeant. Somebody has to keep the book."', '"Don\'t make me count you, Sergeant. You\'re not in the ledger."'];
    assert.ok(voice.includes(say(g, 'ask pike about mary').split('\n')[0]));
    assert.equal(say(g, 'attack pike').split('\n')[0], 'He is quicker with that knife than you are with your fists. Cuffs, not fists.');
    say(g, 'arrest pike');
    assert.equal(say(g, 'talk to pike'), '"I would have stopped at five," he says. "Five is a gate. You close a gate."');
    assert.equal(say(g, 'tell pike about harrow'), '"I would have stopped at five," he says. "Five is a gate. You close a gate."');
    assert.equal(say(g, 'attack pike'), "He is cuffed and on his knees. That isn't who you are.");
    assert.match(say(g, 'x pike'), /^Cuffed, on his knees\./);
  });

  test('ACCUSE down here: a repeat says its text without a second award; with too little evidence, "Prove it"', () => {
    const g = inCountingRoom();
    assert.match(say(g, 'accuse pike'), /^You say it out loud: the whole caution, every name\./);
    assert.equal(snap(g).score, 80);
    const h = inCountingRoom();
    setup(h, (s) => { for (const id of ['button', 'ledger_page', 'patient_file']) s.items[id].loc = 'tunnel'; });
    const n0 = snap(h).nerve;
    assert.equal(say(h, 'accuse pike').split('\n')[0], '"Prove it," says Pike, and smiles, and goes on counting.');
    assert.equal(snap(h).nerve, n0 + 15 + 3);
    assert.equal(say(h, 'accuse harrow').split('\n')[0], '"Me?" Harrow manages a laugh. "I\'m the one in chains, kid."');
  });

  test('Harrow: talk, door / tunnel, cuffs, cutters, before and after', () => {
    const g = inCountingRoom();
    assert.equal(say(g, 'talk to harrow').split('\n')[0], '"Don\'t talk to me - cuff him! Cuff him, kid!"');
    say(g, 'arrest pike');
    assert.equal(say(g, 'talk to harrow'), '"Kid. Cutters. Get me down."');
    const door = '"He always leaves himself a way out. Lifted the bar when he came down. Counts his exits, this one."';
    assert.equal(say(g, 'ask harrow about the door'), door);
    assert.equal(say(g, 'ask harrow about tunnel'), door);
    assert.equal(say(g, 'ask harrow about cuffs'), '"Then use them!"');
    assert.equal(say(g, 'ask harrow about cutters'), '"Cut me down, then!"');
    assert.equal(say(g, 'ask harrow about himself'), '"Bleeding. Don\'t make a thing of it."');
    assert.equal(say(g, 'attack harrow'), "He's on your side. Mostly.");
    assert.match(say(g, 'x harrow'), /"Kid\."$/);
    assert.equal(say(g, 'ask harrow about maggie').split('\n')[0], '"Later, kid. Later."');
  });

  test('Harrow freed (Pike still counting): desc, here-text, chains', () => {
    const g = inCountingRoom();
    say(g, 'cut chains');
    assert.equal(say(g, 'ask harrow about chains').split('\n')[0], '"Done. Now him."');
    say(g, 's'); // step out so the counter pauses
    const look = say(g, 'n');
    assert.match(look, /Harrow sits slumped beneath them, the cut chains at his feet\. The door is south\./);
    assert.match(look, /Frank Harrow sits against the wall, one hand pressed to his side\./);
    assert.equal(say(g, 'arrest pike').split('\n')[0], 'Frank throws himself at Pike\'s knees as you go for the knife arm. Pike is a big man, but a tired one; he has been counting all night. The knife rings on the brick. Click. Click. Pike sits back against the wall and goes very still.');
    assert.equal(snap(g).ended, 'victory');
  });

  test('Harrow\'s desc changes at 23:30 while he is still chained', () => {
    const g = inCountingRoom();
    say(g, 'arrest pike');
    setup(g, (s) => { s.turn = 245; });
    assert.match(say(g, 'x harrow'), /^Frank Harrow, chained by the wrists, grey as ash\./);
  });

  test('TURN OFF TORCH is warned once, only in here and only while Pike counts', () => {
    const g = inTunnel();
    assert.equal(say(g, 'turn off torch').split('\n')[0], 'The torch is now off.');
    say(g, 'turn on torch');
    say(g, 'n');
    const t = say(g, 'switch off torch');
    assert.match(t, /^Switch off your only light, with Pike and his knife in here\? He counts by touch\. You do not\./);
    assert.equal(snap(g).items.torch.lit, true);
    const h = inCountingRoom();
    say(h, 'arrest pike');
    assert.equal(say(h, 'turn off torch').split('\n')[0], 'The torch is now off.');
    assert.equal(snap(h).flags.dark_warned, undefined);
  });
});

/* ------------------------------------------------------------------------ *
 *  STORY §10: the last four hint steps                                       *
 * ------------------------------------------------------------------------ */

describe('hints at the end of the critical path', () => {
  const tier1 = (g) => say(g, 'hint').split('\n')[0];
  test('way down, door, arrest, free - in that order', () => {
    assert.equal(tier1(after(87)), "Harrow is under the mill, but Pike's trap won't open. Silas told you of other ways down.");
    assert.equal(tier1(after(88)), 'The iron door is barred from the far side. Somebody has to open it from in there.');
    assert.equal(tier1(after(89)), "Pike has a knife and he's counting. You haven't long.");
    assert.equal(tier1(after(90)), 'Frank is chained to the wall.');
  });

  test('the tiers advance and each costs 2 points', () => {
    const g = after(87);
    say(g, 'hint');
    assert.equal(say(g, 'hint').split('\n')[0], 'The file speaks of a morgue drawer that does not close. And the boiler-room hatch wants oil.');
    assert.equal(say(g, 'hint').split('\n')[0], 'Asylum morgue, torch on: PULL DRAWER, then DOWN. Or mill boiler room: OIL HATCH, OPEN HATCH, DOWN.');
    assert.equal(snap(g).score, 80 - 6);
  });
});
