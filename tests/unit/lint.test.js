import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintContent, formatFinding } from '../../tools/lint-content.js';
import { hasGlyph } from '../../src/ui/font8x8.js';
import realContent from '../../src/content/index.js';
import mini from '../fixtures/mini-world.js';
import { BAD_WORLDS, freshMini } from '../fixtures/lint-bad.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LINT = fileURLToPath(new URL('../../tools/lint-content.js', import.meta.url));
const lint = (content, opts = {}) => lintContent(content, { hasGlyph, ...opts });
const show = (r) => [...r.errors.map((f) => formatFinding('error', f)), ...r.warnings.map((f) => formatFinding('warning', f))].join('\n');

test('the real (still empty) content bundle lints without errors; strict mode refuses an empty bundle', () => {
  const r = lint(realContent);
  assert.deepEqual(r.errors, [], show(r));
  assert.ok(r.warnings.some((w) => w.rule === 'L01'), 'empty bundle is reported as a warning');
  assert.ok(lint(realContent, { strict: true }).errors.length > 0);
});

test('mini-world lints with zero errors; its only warning is the declared stub', () => {
  const r = lint(mini);
  assert.deepEqual(r.errors, [], show(r));
  assert.deepEqual(r.warnings.map((w) => w.rule), ['L14'], show(r));
});

test('mini-world in strict mode fails only on the stub', () => {
  const r = lint(mini, { strict: true });
  assert.deepEqual(r.errors.map((e) => e.rule), ['L14'], show(r));
});

test('lintContent does not mutate content', () => {
  const c = freshMini();
  const before = JSON.stringify(c);
  lint(c);
  assert.equal(JSON.stringify(c), before);
});

test('finding format: "ERROR L05 rooms.x.exits.e: message"', () => {
  assert.equal(formatFinding('error', { rule: 'L05', path: 'rooms.lock.exits.e', message: 'no exit back from towpath' }),
    'ERROR L05 rooms.lock.exits.e: no exit back from towpath');
  assert.equal(formatFinding('warning', { rule: 'L12', path: 'rooms.pub', message: 'no picture' }), 'WARN L12 rooms.pub: no picture');
});

for (const bad of BAD_WORLDS) {
  test(`lint catches ${bad.rule} (${bad.level}${bad.strict ? ', strict' : ''}): ${bad.name}`, () => {
    const c = freshMini();
    bad.mutate(c);
    let r;
    assert.doesNotThrow(() => { r = lint(c, { strict: !!bad.strict }); }, 'lint never throws');
    const list = bad.level === 'error' ? r.errors : r.warnings;
    assert.ok(list.some((f) => f.rule === bad.rule), `expected ${bad.level} ${bad.rule}; got:\n${show(r)}`);
    if (bad.level === 'warning') assert.ok(!r.errors.some((f) => f.rule === bad.rule), `${bad.rule} should only warn`);
  });
}

test('every rule L01–L23 has at least one bad fixture', () => {
  const rules = new Set(BAD_WORLDS.map((b) => b.rule));
  for (let i = 1; i <= 23; i++) assert.ok(rules.has(`L${String(i).padStart(2, '0')}`), `L${i}`);
});

test('L21 also warns on verb words supplied by the vocabulary', () => {
  const c = freshMini();
  c.items.brass_key.adjectives.push('grab');
  const r = lint(c, { verbWords: ['grab', 'pick up'] });
  assert.ok(r.warnings.some((w) => w.rule === 'L21' && /grab/.test(w.message)), show(r));
});

test('lint survives garbage bundles without throwing', () => {
  for (const junk of [null, 42, 'x', [], { rooms: 'x' }, { rooms: { a: null } }, { ...freshMini(), items: { k: null } }]) {
    const r = lint(junk);
    assert.ok(Array.isArray(r.errors) && Array.isArray(r.warnings));
  }
});

test('CLI: exit 0 on mini-world (incremental), exit 1 with --strict, ERROR / WARN line format', () => {
  const ok = spawnSync(process.execPath, [LINT, '--content', 'tests/fixtures/mini-world.js'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /^WARN L14 stubs\.towpath: /m);
  const strict = spawnSync(process.execPath, [LINT, '--strict', '--content', 'tests/fixtures/mini-world.js'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(strict.status, 1);
  assert.match(strict.stdout + strict.stderr, /^ERROR L14 stubs\.towpath: /m);
});

test('CLI: the real content passes (npm run lint:content)', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, [LINT], { cwd: ROOT, encoding: 'utf8' }));
});
