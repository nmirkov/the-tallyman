import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter, renderMarkdown, esc, planMilestones, buildHtml, boardMarkdown } from '../../tools/progress.js';

test('front-matter: scalars, arrays, quotes, body', () => {
  const { data, body } = parseFrontMatter('---\nid: TT-9\ntitle: "Hello: world"\ndepends: [TT-1, TT-2]\nnone: []\n---\n# Body\n');
  assert.equal(data.id, 'TT-9');
  assert.equal(data.title, 'Hello: world');
  assert.deepEqual(data.depends, ['TT-1', 'TT-2']);
  assert.deepEqual(data.none, []);
  assert.equal(body, '# Body\n');
});

test('front-matter: absent block returns empty data', () => {
  assert.deepEqual(parseFrontMatter('# just text').data, {});
});

test('markdown: tables render with header and body', () => {
  const h = renderMarkdown('| A | B |\n|---|---|\n| 1 | **x** |\n| 2 | `c` |');
  assert.match(h, /<th>A<\/th><th>B<\/th>/);
  assert.match(h, /<td><strong>x<\/strong><\/td>/);
  assert.match(h, /<td><code>c<\/code><\/td>/);
});

test('markdown: lists, headings, paragraphs', () => {
  const h = renderMarkdown('# T\n\n- a\n- b\n\n1. one\n2. two\n\npara line\nsecond');
  assert.match(h, /<h1>T<\/h1>/);
  assert.match(h, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(h, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(h, /<p>para line second<\/p>/);
});

test('markdown: escapes HTML everywhere', () => {
  const h = renderMarkdown('# <script>x</script>\n\n| <b> |\n|---|\n| "q" & `<i>` |\n\n- <img onerror=1>');
  assert.ok(!/<script|<b>|<img|<i>/.test(h));
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /&amp;/);
});

test('esc handles quotes and nullish', () => {
  assert.equal(esc(`<a href="x">'`), '&lt;a href=&quot;x&quot;&gt;&#39;');
  assert.equal(esc(undefined), '');
});

test('planMilestones reads section 5 headings', () => {
  const m = planMilestones('## 5. Delivery\n### M0 — Foundations\n### M1 — Engine\n## 6. X\n### M9 — Nope');
  assert.deepEqual(m, { M0: 'Foundations', M1: 'Engine' });
});

test('buildHtml escapes ticket text; board lists tickets', () => {
  const tickets = [{ id: 'TT-1', title: '<img src=x onerror=1>', milestone: 'M0', status: 'done', agent: 'a', model: 'm', depends: [], severity: '' }];
  const html = buildHtml({ tickets, names: { M0: 'F' }, plan: '', status: '**Phase:** go', reviews: '', commits: [], tags: [], shots: [], now: new Date(0) });
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /100%/);
  assert.match(boardMarkdown(tickets, { M0: 'F' }), /\| TT-1 \|/);
});
