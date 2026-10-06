// TT-011: pure (DOM-free) parts of the terminal — wrapping, paging, history, input editing,
// typewriter scheduling, scrollback and the composed region view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapLine, wrapText, textWidth } from '../../src/ui/wrap.js';
import {
  createHistory, editInput, inputWindow, typeBudget, blinkOn, regionFor, outputRows,
  needsMore, styleRole, sanitiseInput, createTerminalCore, PROMPT, MORE_TEXT, MAX_TICK_MS,
} from '../../src/ui/terminal.js';
import { CURSOR } from '../../src/ui/font8x8.js';

const W40 = 'x'.repeat(40);

// ---------- wrap ----------

test('wrap: short line unchanged; empty text gives one empty line', () => {
  assert.deepEqual(wrapLine('Taken.'), ['Taken.']);
  assert.deepEqual(wrapLine(''), ['']);
  assert.deepEqual(wrapText(''), ['']);
});

test('wrap: exactly 40 columns fits on one line', () => {
  const s = 'Rain needles the cobbles. The old mill X';
  assert.equal(s.length, 40);
  assert.deepEqual(wrapLine(s), [s]);
  assert.deepEqual(wrapLine(W40), [W40]);
});

test('wrap: breaks at the last space that fits, never inside a word', () => {
  const s = 'Rain needles the cobbles. The old mill looms to the west, its windows lit by a light.';
  const lines = wrapLine(s);
  assert.deepEqual(lines, [
    'Rain needles the cobbles. The old mill',
    'looms to the west, its windows lit by a',
    'light.',
  ]);
  for (const l of lines) assert.ok(l.length <= 40);
  assert.equal(lines.join(' '), s);
});

test('wrap: 41-char line breaks before the word that crosses column 40', () => {
  const s = `${'a'.repeat(35)} bcdef`;
  assert.equal(s.length, 41);
  assert.deepEqual(wrapLine(s), ['a'.repeat(35), 'bcdef']);
});

test('wrap: words longer than the width are hard-split', () => {
  assert.deepEqual(wrapLine('y'.repeat(95)), ['y'.repeat(40), 'y'.repeat(40), 'y'.repeat(15)]);
  assert.deepEqual(wrapLine(`see ${'z'.repeat(45)} now`), ['see', 'z'.repeat(40), 'zzzzz now']);
  assert.deepEqual(wrapLine(W40 + 'x'), [W40, 'x']);
});

test('wrap: multiple spaces kept inside a line, dropped at wrap points and line ends', () => {
  assert.deepEqual(wrapLine('a  b   c'), ['a  b   c']);
  assert.deepEqual(wrapLine('end.   '), ['end.']);
  const s = `${'a'.repeat(38)}     bb`;
  assert.deepEqual(wrapLine(s), ['a'.repeat(38), 'bb']);
  assert.deepEqual(wrapLine('  indented'), ['  indented'], 'leading indent of a paragraph kept');
  assert.deepEqual(wrapLine('     '), [''], 'all-space line is blank');
});

test('wrap: £ counts as one column', () => {
  const s = `${'p'.repeat(36)} £2.`;
  assert.equal(textWidth(s), 40);
  assert.deepEqual(wrapLine(s), [s]);
  assert.deepEqual(wrapLine(`${'p'.repeat(36)} £2.0`), ['p'.repeat(36), '£2.0']);
});

test('wrap: newlines split paragraphs and empty lines are preserved', () => {
  assert.deepEqual(wrapText('one\ntwo'), ['one', 'two']);
  assert.deepEqual(wrapText('one\n\ntwo'), ['one', '', 'two']);
  assert.deepEqual(wrapText('\n'), ['', '']);
  assert.deepEqual(wrapText('a\r\nb'), ['a', 'b']);
});

test('wrap: custom width', () => {
  assert.deepEqual(wrapLine('the cat sat on the mat', 10), ['the cat', 'sat on the', 'mat']);
});

// ---------- paging / regions ----------

test('regions: rows 11-24 with pictures, 1-24 without; input is the bottom row', () => {
  assert.deepEqual(regionFor(true), { top: 11, bottom: 24 });
  assert.deepEqual(regionFor(false), { top: 1, bottom: 24 });
  assert.equal(outputRows(regionFor(true)), 13);
  assert.equal(outputRows(regionFor(false)), 23);
});

test('paging: MORE once a full page of new lines has been shown', () => {
  assert.equal(needsMore(12, 13), false);
  assert.equal(needsMore(13, 13), true);
  assert.equal(needsMore(0, 13), false);
});

test('styles map to theme colour roles', () => {
  assert.equal(styleRole('normal'), 'fg');
  assert.equal(styleRole(undefined), 'fg');
  for (const s of ['title', 'alert', 'whisper', 'echo', 'system']) assert.equal(styleRole(s), s);
  assert.equal(styleRole('bogus'), 'fg');
});

// ---------- history ----------

test('history: up/down walks entries and restores the draft', () => {
  const h = createHistory(50);
  h.push('look');
  h.push('take stick');
  assert.equal(h.prev('dra'), 'take stick');
  assert.equal(h.prev('take stick'), 'look');
  assert.equal(h.prev('look'), null, 'stops at oldest');
  assert.equal(h.next(), 'take stick');
  assert.equal(h.next(), 'dra', 'draft restored past the newest');
  assert.equal(h.next(), null);
});

test('history: skips blanks and immediate duplicates, keeps the last 50', () => {
  const h = createHistory(50);
  h.push('');
  h.push('   ');
  h.push('n');
  h.push('n');
  assert.deepEqual(h.entries, ['n']);
  for (let i = 0; i < 60; i++) h.push(`cmd ${i}`);
  assert.equal(h.entries.length, 50);
  assert.equal(h.entries[0], 'cmd 10');
  assert.equal(h.entries.at(-1), 'cmd 59');
});

test('history: push resets the walk position', () => {
  const h = createHistory();
  h.push('a');
  h.push('b');
  h.prev('');
  h.prev('');
  h.push('c');
  assert.equal(h.prev(''), 'c');
});

// ---------- input editing ----------

test('input: insert, backspace, delete, left, right, home, end', () => {
  let s = { text: '', cursor: 0 };
  for (const c of 'tke') s = editInput(s, { op: 'insert', text: c });
  assert.deepEqual(s, { text: 'tke', cursor: 3 });
  s = editInput(s, { op: 'left' });
  s = editInput(s, { op: 'left' });
  s = editInput(s, { op: 'insert', text: 'a' });
  assert.deepEqual(s, { text: 'take', cursor: 2 });
  s = editInput(s, { op: 'home' });
  assert.equal(s.cursor, 0);
  assert.deepEqual(editInput(s, { op: 'backspace' }), s, 'backspace at start is a no-op');
  s = editInput(s, { op: 'delete' });
  assert.deepEqual(s, { text: 'ake', cursor: 0 });
  s = editInput(s, { op: 'end' });
  assert.equal(s.cursor, 3);
  assert.deepEqual(editInput(s, { op: 'right' }), s, 'right at end is a no-op');
  assert.deepEqual(editInput(s, { op: 'delete' }), s, 'delete at end is a no-op');
  s = editInput(s, { op: 'backspace' });
  assert.deepEqual(s, { text: 'ak', cursor: 2 });
});

test('input: max length 120 and only printable characters', () => {
  let s = { text: 'a'.repeat(119), cursor: 119 };
  s = editInput(s, { op: 'insert', text: 'bcd' });
  assert.equal(s.text.length, 120);
  assert.equal(s.text.at(-1), 'b');
  assert.deepEqual(editInput(s, { op: 'insert', text: 'z' }), s);
  assert.equal(sanitiseInput('it’s “ok”\t£5\u0007é'), 'it\'s "ok" £5');
});

test('input window: horizontal scroll keeps the cursor visible', () => {
  assert.equal(inputWindow(10, 10, 38, 0), 0);
  assert.equal(inputWindow(50, 50, 38, 0), 13, 'cursor at end sits in the last visible column');
  assert.equal(inputWindow(50, 5, 38, 13), 5, 'moving left scrolls back');
  assert.equal(inputWindow(50, 20, 38, 5), 5, 'no scroll while the cursor stays in view');
  assert.equal(inputWindow(10, 3, 38, 13), 0, 'clamped when the text got shorter');
});

// ---------- typewriter / blink math ----------

test('typewriter: budget from elapsed time at a rate with fractional carry', () => {
  assert.deepEqual(typeBudget(0, 10, 400), { chars: 4, carry: 0 });
  const a = typeBudget(0, 16, 400); // 6.4 chars
  assert.equal(a.chars, 6);
  assert.ok(Math.abs(a.carry - 0.4) < 1e-9);
  const b = typeBudget(a.carry, 16, 400); // 6.8
  assert.equal(b.chars, 6);
  const c = typeBudget(b.carry, 16, 400); // 7.2
  assert.equal(c.chars, 7);
  assert.equal(typeBudget(0, -5, 400).chars, 0, 'clock going backwards gives nothing');
});

test('blink: ~1.6 Hz, phase restarts at the epoch', () => {
  assert.equal(blinkOn(0, 0, 1.6), true);
  assert.equal(blinkOn(312, 0, 1.6), true);
  assert.equal(blinkOn(313, 0, 1.6), false);
  assert.equal(blinkOn(625, 0, 1.6), true);
  assert.equal(blinkOn(1000, 990, 1.6), true);
});

// ---------- core: helpers ----------

function makeCore(opts = {}) {
  const submitted = [];
  const keys = [];
  const core = createTerminalCore({
    onSubmit: (l) => submitted.push(l),
    onKey: (k) => keys.push(k),
    ...opts,
  });
  let now = 0;
  const tick = (ms = 16) => { now += ms; core.tick(now); };
  const run = (ms = 5000, step = 16) => { for (let t = 0; t < ms; t += step) tick(step); };
  const rowText = (r) => r.map((c) => c.ch).join('').trimEnd();
  const screen = () => core.compose(now).rows.map(rowText);
  const type = (s) => { for (const c of s) core.key(c); };
  return { core, submitted, keys, tick, run, screen, type, get now() { return now; } };
}

// ---------- core: typewriter ----------

test('core: typewriter reveals ~400 chars/s, instant when off', () => {
  const t = makeCore();
  t.core.print('x'.repeat(40));
  t.tick(0);
  t.tick(50); // 20 chars
  assert.equal(t.screen()[0], 'x'.repeat(20));
  assert.equal(t.core.busy, true);
  t.tick(50);
  assert.equal(t.screen()[0], 'x'.repeat(40));
  t.tick(16);
  assert.equal(t.core.busy, false);

  const u = makeCore({ typewriter: false });
  u.core.print('hello there');
  u.tick(1);
  assert.equal(u.screen()[0], 'hello there');
  assert.equal(u.core.busy, false);

  const r = makeCore({ reducedMotion: true });
  r.core.print('no motion please');
  r.tick(1);
  assert.equal(r.screen()[0], 'no motion please', 'prefers-reduced-motion = instant');
});

test('core: a long gap between ticks (terminal not ticked on the title / boot) is not typing budget (TT-106)', () => {
  // R2-1 issue 1: last tick before QUIT, no ticks while the title is up, then the intro
  const t = makeCore();
  t.core.tick(0);
  t.core.print('y'.repeat(400));
  t.core.tick(60000);
  const ys = t.core.compose(60000).rows.flat().filter((c) => c.ch === 'y').length;
  assert.ok(ys <= Math.ceil(MAX_TICK_MS * 0.4), `at most one clamped frame of text, got ${ys} chars`);
  assert.equal(t.core.more, false, 'no [MORE] page dumped at once');
  t.core.tick(60016);
  const after = t.core.compose(60016).rows.flat().filter((c) => c.ch === 'y').length;
  assert.ok(after - ys <= 7, 'then 400 cps again');
});

test('core: resetClock() makes the next tick start from zero elapsed time (TT-106)', () => {
  const t = makeCore();
  t.core.tick(0);
  t.core.tick(16);
  t.core.resetClock();
  t.core.print('x'.repeat(40));
  t.core.tick(90000);
  assert.equal(t.core.compose(90000).rows[0].filter((c) => c.ch === 'x').length, 0, 'first tick after reset: no time has passed');
  t.core.tick(90025);
  assert.equal(t.core.compose(90025).rows[0].filter((c) => c.ch === 'x').length, 10, '25 ms at 400 cps');
});

test('core: any key fast-forwards the current output', () => {
  const t = makeCore();
  t.core.print('a'.repeat(200));
  t.tick(0);
  t.tick(16);
  assert.equal(t.core.key('Shift'), false, 'modifier keys are ignored');
  assert.equal(t.core.key(' '), true);
  t.tick(16);
  assert.equal(t.core.busy, false);
  assert.equal(t.screen().slice(0, 5).join(''), 'a'.repeat(200));
  assert.equal(t.core.input.text, '', 'space used to skip is not typed');
});

test('core: a printable key that skips is kept as type-ahead', () => {
  const t = makeCore();
  t.core.print('a long line of output text');
  t.tick(0);
  t.core.key('l');
  t.tick(16);
  assert.equal(t.core.ready, true);
  assert.equal(t.core.input.text, 'l');
});

test('core: pause waits, any key skips it', () => {
  const t = makeCore({ typewriter: false });
  t.core.print('one');
  t.core.pause(1000);
  t.core.print('two');
  t.tick(0);
  t.tick(16);
  assert.deepEqual(t.screen().slice(0, 2), ['one', '']);
  t.tick(500);
  assert.equal(t.screen()[1], '');
  t.tick(600);
  assert.equal(t.screen()[1], 'two');

  t.core.pause(5000);
  t.core.print('three');
  t.tick(16);
  t.core.key('Escape');
  t.tick(16);
  assert.equal(t.screen()[2], 'three');
});

test('core: marks fire in order when the output reaches them', () => {
  const t = makeCore();
  const fired = [];
  t.core.print('abcdefghij');
  t.core.mark(() => fired.push('after-text'));
  t.tick(0);
  t.tick(10); // 4 chars
  assert.deepEqual(fired, []);
  t.run(100);
  assert.deepEqual(fired, ['after-text']);
});

// ---------- core: paging ----------

test('core: [MORE] after a page of new output; key continues; one context line kept', () => {
  const t = makeCore({ typewriter: false });
  for (let i = 1; i <= 30; i++) t.core.print(`line ${i}`);
  t.tick(0);
  t.tick(16);
  assert.equal(t.core.more, true);
  let s = t.screen();
  assert.equal(s[0], 'line 1');
  assert.equal(s[12], 'line 13');
  assert.equal(s[13], MORE_TEXT, '[MORE] on the input row');
  t.run(500);
  assert.equal(t.core.more, true, 'MORE waits for a key');
  assert.equal(t.core.key('q'), true);
  assert.equal(t.core.input.text, '', 'the continue key is swallowed');
  t.tick(16);
  s = t.screen();
  assert.equal(s[0], 'line 13', 'last line of the previous page stays as context');
  assert.equal(s[12], 'line 25');
  assert.equal(t.core.more, true);
  t.core.key('Enter');
  t.tick(16);
  assert.equal(t.core.more, false);
  assert.equal(t.screen()[12], 'line 30');
  assert.equal(t.core.ready, true);
});

test('core: no MORE when the output fits; the counter restarts at each input', () => {
  const t = makeCore({ typewriter: false });
  for (let i = 1; i <= 10; i++) t.core.print(`a${i}`);
  t.tick(16);
  assert.equal(t.core.more, false);
  t.type('x');
  t.core.key('Enter');
  for (let i = 1; i <= 11; i++) t.core.print(`b${i}`);
  t.tick(16);
  assert.equal(t.core.more, false, 'echo + 11 lines = 12 rows: fits');
  t.core.key('Enter');
  for (let i = 1; i <= 13; i++) t.core.print(`c${i}`);
  t.tick(16);
  assert.equal(t.core.more, true, 'echo + 13 lines exceeds the 13-row page');
  assert.equal(t.screen()[0], '>', 'the (empty) echo heads the page');
});

test('core: graphics off gives a 23-row page', () => {
  const t = makeCore({ typewriter: false, graphics: false });
  assert.equal(t.core.compose(0).top, 1);
  for (let i = 1; i <= 30; i++) t.core.print(`l${i}`);
  t.tick(16);
  assert.equal(t.core.compose(0).rows.length, 24);
  assert.equal(t.screen()[22], 'l23');
  assert.equal(t.core.more, true);
  t.core.setGraphics(true);
  assert.equal(t.core.compose(0).top, 11);
  assert.equal(t.screen()[12], 'l23', 'shrinking the region keeps the newest lines');
});

test('core: clear empties the region and restarts the page count', () => {
  const t = makeCore({ typewriter: false });
  for (let i = 1; i <= 8; i++) t.core.print(`old ${i}`);
  t.core.clear();
  for (let i = 1; i <= 13; i++) t.core.print(`new ${i}`);
  t.tick(16);
  assert.equal(t.core.more, false);
  const s = t.screen();
  assert.equal(s[0], 'new 1');
  assert.equal(s[12], 'new 13');
});

test('core: paragraph spacing — blank line before a command echo and before a title', () => {
  const t = makeCore({ typewriter: false });
  t.core.print('Mill Yard', 'title');
  t.core.print('Rain needles the cobbles.');
  t.tick(16);
  t.type('take stick');
  t.core.key('Enter');
  t.core.print('Taken.');
  t.core.print('Canal Bank', 'title');
  t.core.print('Water.');
  t.tick(16);
  assert.deepEqual(t.screen().slice(0, 8), [
    'Mill Yard', 'Rain needles the cobbles.', '', '> take stick', 'Taken.', '', 'Canal Bank', 'Water.',
  ]);
  const rows = t.core.compose(t.now).rows;
  assert.equal(rows[0][0].role, 'title');
  assert.equal(rows[1][0].role, 'fg');
  assert.equal(rows[3][0].role, 'echo');
});

test('core: long text events are wrapped at 40 columns', () => {
  const t = makeCore({ typewriter: false });
  t.core.print('Rain needles the cobbles. The old mill looms to the west.');
  t.tick(16);
  assert.deepEqual(t.screen().slice(0, 2), ['Rain needles the cobbles. The old mill', 'looms to the west.']);
});

// ---------- core: input line ----------

test('core: input row shows prompt, text and a block cursor; Enter echoes and submits', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  t.type('look');
  let row = t.core.compose(t.now).rows[13];
  assert.equal(row.slice(0, 6).map((c) => c.ch).join(''), `${PROMPT}look`);
  assert.equal(row[6].ch, CURSOR);
  assert.equal(row[6].role, 'cursor');
  t.core.key('ArrowLeft');
  row = t.core.compose(t.now).rows[13];
  assert.equal(row[5].ch, 'k');
  assert.equal(row[5].inverse, true, 'cursor over a character is reverse video');
  t.core.key('Enter');
  assert.deepEqual(t.submitted, ['look']);
  assert.equal(t.core.input.text, '');
  t.tick(16);
  assert.equal(t.screen()[0], '> look');
  assert.deepEqual(t.keys.slice(0, 5), ['char', 'char', 'char', 'char', 'move']);
  assert.equal(t.keys.at(-1), 'enter');
});

test('core: Enter while output is still typing skips instead of submitting', () => {
  const t = makeCore();
  t.core.print('x'.repeat(100));
  t.tick(0);
  t.core.key('Enter');
  assert.deepEqual(t.submitted, []);
});

test('core: cursor blinks at 1.6 Hz and is solid right after a keystroke', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  const cur = () => t.core.compose(t.now).rows[13][PROMPT.length].ch;
  t.tick(300);
  const a = cur();
  t.tick(320);
  const b = cur();
  assert.notEqual(a, b, 'toggles every ~312 ms');
  t.core.key('a');
  assert.equal(t.core.compose(t.now).rows[13][PROMPT.length + 1].ch, CURSOR);
  const still = makeCore({ typewriter: false, reducedMotion: true });
  still.tick(16);
  still.tick(330);
  assert.equal(still.core.compose(still.now).rows[13][PROMPT.length].ch, CURSOR, 'no blink under reduced motion');
});

test('core: long input scrolls horizontally within the line', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  const long = 'abcdefghij'.repeat(5);
  t.type(long);
  const row = t.core.compose(t.now).rows[13];
  const text = row.map((c) => c.ch).join('');
  assert.equal(row[39].ch, CURSOR, 'cursor in the last column');
  assert.ok(text.endsWith(`${long.slice(-37)}${CURSOR}`));
  t.core.key('Home');
  const home = t.core.compose(t.now).rows[13].map((c) => c.ch).join('');
  assert.equal(home.slice(PROMPT.length, PROMPT.length + 10), 'abcdefghij');
});

test('core: history ↑ recalls the last command, ↓ returns to the draft', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  t.type('take stick');
  t.core.key('Enter');
  t.tick(16);
  t.type('n');
  t.core.key('Enter');
  t.tick(16);
  t.type('dr');
  t.core.key('ArrowUp');
  assert.deepEqual(t.core.input, { text: 'n', cursor: 1 });
  t.core.key('ArrowUp');
  assert.deepEqual(t.core.input, { text: 'take stick', cursor: 10 });
  t.core.key('ArrowDown');
  t.core.key('ArrowDown');
  assert.deepEqual(t.core.input, { text: 'dr', cursor: 2 });
});

test('core: setInput mirrors a mobile <input> value (sanitised, clamped)', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  t.core.setInput('go north’s', 4);
  assert.deepEqual(t.core.input, { text: "go north's", cursor: 4 });
  t.core.setInput('q'.repeat(200), 200);
  assert.equal(t.core.input.text.length, 120);
  assert.equal(t.core.input.cursor, 120);
});

test('core: input disabled hides the prompt and ignores typing', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  t.core.setInputEnabled(false);
  assert.equal(t.core.key('a'), false);
  assert.equal(t.screen()[13], '');
  t.core.setInputEnabled(true);
  t.core.key('a');
  assert.equal(t.core.input.text, 'a');
});

// ---------- core: scrollback ----------

test('core: PgUp/PgDn scroll back through history; any key returns to the bottom', () => {
  const t = makeCore({ typewriter: false });
  for (let i = 1; i <= 40; i++) {
    t.core.print(`s${i}`);
    if (i % 10 === 0) { t.tick(16); t.core.key('Enter'); }
  }
  t.tick(16);
  while (t.core.more) { t.core.key(' '); t.tick(16); }
  const bottom = t.screen().slice(0, 13);
  t.core.key('PageUp');
  let s = t.screen();
  assert.notDeepEqual(s.slice(0, 13), bottom);
  assert.equal(t.core.scrollOffset, 12);
  assert.match(s[13], /BACK/);
  t.core.key('PageUp');
  t.core.key('PageUp');
  t.core.key('PageUp');
  t.core.key('PageUp');
  s = t.screen();
  assert.equal(s[0], 's1', 'clamped at the oldest line');
  t.core.key('PageDown');
  assert.ok(t.core.scrollOffset > 0);
  assert.equal(t.core.key('x'), true);
  assert.equal(t.core.scrollOffset, 0);
  assert.equal(t.core.input.text, '', 'the returning key is view-only');
  assert.deepEqual(t.screen().slice(0, 13), bottom);
});

test('core: scrollback keeps the last 500 lines', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  for (let i = 0; i < 700; i++) t.core.print(`n${i}`);
  for (let k = 0; k < 200 && t.core.busy; k++) { t.tick(16); t.core.key(' '); }
  assert.equal(t.core.lineCount, 500);
  for (let k = 0; k < 100; k++) t.core.key('PageUp');
  assert.equal(t.screen()[0], 'n200');
});

test('core: PgUp works while [MORE] is waiting and does not continue it', () => {
  const t = makeCore({ typewriter: false });
  for (let i = 1; i <= 30; i++) t.core.print(`m${i}`);
  t.tick(16);
  assert.equal(t.core.more, true);
  t.core.key('PageUp');
  assert.equal(t.core.more, true);
  assert.equal(t.core.scrollOffset, 0, 'nothing older than the top of the page yet');
});

test('core: key SFX hook fires per accepted keystroke', () => {
  const t = makeCore({ typewriter: false });
  t.tick(16);
  t.type('ab');
  t.core.key('Backspace');
  t.core.key('ArrowUp');
  t.core.key('Enter');
  assert.deepEqual(t.keys, ['char', 'char', 'delete', 'move', 'enter']);
});
