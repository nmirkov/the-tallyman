// Generates docs/progress.html and tickets/BOARD.md (PLAN §6.4). Zero dependencies.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const STATUSES = ['todo', 'in-progress', 'verify', 'done', 'blocked'];

/** Escape text for safe HTML embedding. */
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Parse `---` delimited front-matter (flat key: value, `[a, b]` arrays).
 * @param {string} text
 * @returns {{data: Record<string, string|string[]>, body: string}}
 */
export function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
    } else if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

/** Inline markdown on already-untrusted text: escapes first, then code/bold/italic/links. */
export function inline(s) {
  const codes = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[\w./#-]+)\)/g, '<a href="$2">$1</a>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const splitRow = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

/**
 * Minimal markdown to HTML: headings, tables, lists, paragraphs, quotes, rules, fenced code.
 * @param {string} md
 * @param {number} [base] heading level offset (h1 in md becomes h{1+base})
 */
export function renderMarkdown(md, base = 0) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const buf = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) buf.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
    } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      const lvl = Math.min(6, m[1].length + base);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); i++;
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; }
    else if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(splitRow(lines[i]));
      out.push('<div class="tw"><table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      const items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i + 1])) {
          items[items.length - 1] += ' ' + lines[++i].trim();
        }
      }
      out.push(`<${tag}>` + items.map((x) => `<li>${inline(x)}</li>`).join('') + `</${tag}>`);
    } else if (/^>\s?/.test(line)) {
      const buf = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) buf.push(lines[i].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
    } else {
      const buf = [];
      for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*\||>|\s*([-*]|\d+\.)\s)/.test(lines[i]); i++) buf.push(lines[i].trim());
      if (!buf.length) { buf.push(line.trim()); i++; }
      out.push(`<p>${inline(buf.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '');

/** Extract the text of a `## N.` section of the plan (up to the next `## `). */
export function planSection(plan, num) {
  const m = new RegExp(`^## ${num}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(plan);
  return m ? m[1] : '';
}

/** Milestone names from `### M0 — Foundations` headings in plan §5. */
export function planMilestones(plan) {
  const out = {};
  for (const m of planSection(plan, 5).matchAll(/^### (M\d)\s*[—-]\s*(.+)$/gm)) out[m[1]] = m[2].trim();
  return out;
}

function loadTickets() {
  const dir = join(ROOT, 'tickets');
  if (!existsSync(dir)) return [];
  const list = [];
  for (const d of readdirSync(dir).sort()) {
    const f = join(dir, d, 'ticket.md');
    if (!existsSync(f)) continue;
    const { data } = parseFrontMatter(readFileSync(f, 'utf8'));
    list.push({
      id: data.id || d, title: data.title || d, milestone: data.milestone || '?',
      status: STATUSES.includes(data.status) ? data.status : 'todo',
      agent: data.agent || '', model: data.model || '',
      depends: Array.isArray(data.depends) ? data.depends : [], severity: data.severity || '',
    });
  }
  return list;
}

function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

function loadCommits() {
  return git(['log', '-60', '--pretty=%h%x09%ad%x09%s', '--date=short']).split('\n').filter(Boolean)
    .map((l) => { const [hash, date, ...s] = l.split('\t'); return { hash, date, subject: s.join('\t') }; });
}

const milestoneKeys = (tickets, names) =>
  [...new Set([...Object.keys(names), ...tickets.map((t) => t.milestone)])]
    .sort((a, b) => (a === 'BUG') - (b === 'BUG') || a.localeCompare(b));

/** Markdown board grouped by milestone. */
export function boardMarkdown(tickets, names) {
  const L = ['# Ticket board', '', '_Generated by `npm run progress` — do not edit by hand._', ''];
  for (const ms of milestoneKeys(tickets, names)) {
    const ts = tickets.filter((t) => t.milestone === ms);
    if (!ts.length) continue;
    L.push(`## ${ms}${names[ms] ? ' — ' + names[ms] : ''}`, '', '| ID | Title | Status | Agent | Model | Depends |', '|---|---|---|---|---|---|');
    for (const t of ts) L.push(`| ${t.id} | ${t.title.replace(/\|/g, '\\|')} | ${t.status} | ${t.agent} | ${t.model} | ${t.depends.join(', ') || '—'} |`);
    L.push('');
  }
  return L.join('\n');
}

const CSS = `
:root{--bg:#f4f5f9;--panel:#fff;--ink:#1d2433;--muted:#5d6678;--line:#dde1ea;--c64-border:#a5a5ff;--c64-bg:#4040e0;--c64-ink:#a5a5ff;
--todo:#8a93a6;--in-progress:#d98a00;--verify:#7b4fd6;--done:#1f9d55;--blocked:#d63a3a;--accent:#4040e0;--code:#eceef5}
@media (prefers-color-scheme:dark){:root{--bg:#10131c;--panel:#181c28;--ink:#e4e7f0;--muted:#98a1b5;--line:#2a3042;--accent:#8a8aff;--code:#222839;
--todo:#78819a;--in-progress:#f0a726;--verify:#a58af0;--done:#3cc17a;--blocked:#ef6060}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;overflow-x:hidden}
.c64{background:var(--c64-border);padding:clamp(10px,2vw,28px)}
.c64 .screen{background:var(--c64-bg);color:var(--c64-ink);font-family:'Courier New',ui-monospace,monospace;font-weight:700;padding:20px clamp(14px,3vw,40px);
text-transform:uppercase;letter-spacing:.06em;display:grid;gap:6px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.15)}
.c64 .l1{font-size:clamp(11px,1.4vw,15px)}.c64 h1{margin:6px 0;font-size:clamp(26px,5.5vw,64px);line-height:1.05;letter-spacing:.14em;color:#fff;text-shadow:3px 3px 0 #000a}
.c64 .meta{display:flex;flex-wrap:wrap;gap:6px 36px;font-size:clamp(12px,1.5vw,16px)}.c64 .meta b{color:#fff}
.c64 .cur::after{content:'';display:inline-block;width:.6em;height:1em;background:var(--c64-ink);margin-left:.3em;vertical-align:-.15em;animation:bl 1.1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}@media (prefers-reduced-motion:reduce){.c64 .cur::after{animation:none}}
.c64 .bar{height:14px;background:#2a2aa0;border:2px solid var(--c64-ink);margin-top:4px}.c64 .bar i{display:block;height:100%;background:#fff}
main{padding:32px clamp(16px,3vw,48px)}
nav{display:flex;flex-wrap:wrap;gap:8px 18px;margin:0 0 24px;font-size:14px}nav a{color:var(--accent);text-decoration:none;font-weight:600}nav a:hover{text-decoration:underline}
section{margin:0 0 40px}h2{font-size:22px;margin:0 0 14px;padding-bottom:6px;border-bottom:2px solid var(--line)}
h3,h4{margin:18px 0 8px}a{color:var(--accent)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.ms .name{font-weight:700}.ms .sub{color:var(--muted);font-size:13px;margin-bottom:8px}
.pbar{display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--line);margin:8px 0}.pbar i{display:block;height:100%}
.chips{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--muted)}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:0}
.board{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));align-items:start}
.col{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px;min-width:0}
.col>h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:3px solid var(--st)}
.col>h3 span{color:var(--muted)}
.tk{background:var(--bg);border:1px solid var(--line);border-left:4px solid var(--st);border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:13px}
.tk .id{font-family:ui-monospace,monospace;font-weight:700;font-size:12px}.tk .ttl{display:block;margin:2px 0 6px;overflow-wrap:anywhere}
.tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:9px;background:var(--code);color:var(--muted);margin:0 4px 3px 0}
.empty{color:var(--muted);font-size:12px;font-style:italic}
.tw{overflow-x:auto;margin:10px 0}table{width:100%;border-collapse:collapse;background:var(--panel);font-size:14px}
th,td{text-align:left;vertical-align:top;padding:7px 10px;border-bottom:1px solid var(--line)}th{background:var(--code);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.9em;overflow-wrap:anywhere}pre{overflow-x:auto;background:var(--code);padding:10px;border-radius:6px}
blockquote{margin:10px 0;padding:4px 14px;border-left:4px solid var(--accent);color:var(--muted)}
.prose{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 18px 12px;overflow-wrap:anywhere}
.prose h1,.prose h2,.prose h3{border:0;font-size:17px;margin:16px 0 6px}
.tl{list-style:none;margin:0;padding:0 0 0 14px;border-left:3px solid var(--line)}.tl li{position:relative;padding:3px 0 3px 14px;display:flex;flex-wrap:wrap;gap:2px 12px}
.tl li::before{content:'';position:absolute;left:-22px;top:11px;width:9px;height:9px;border-radius:50%;background:var(--accent)}
.tl .h{font-family:ui-monospace,monospace;color:var(--accent)}.tl .d{color:var(--muted);font-size:13px}.tl .s{flex:1 1 280px;overflow-wrap:anywhere}
.tl .tg{background:var(--done);color:#fff;border-radius:9px;padding:0 8px;font-size:12px}
.shots{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.shots a{display:block;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px;text-decoration:none;color:var(--muted);font-size:12px}
.shots img{width:100%;height:170px;object-fit:cover;object-position:top;border-radius:4px;display:block;margin-bottom:6px;image-rendering:pixelated}
footer{color:var(--muted);font-size:12px;padding:0 clamp(16px,3vw,48px) 28px}
@media (max-width:600px){body{font-size:14px}.c64 .screen{padding:14px}}
`;

function ticketCard(t) {
  return `<div class="tk" style="--st:var(--${t.status})"><span class="id">${esc(t.id)}</span>` +
    (t.severity ? ` <span class="tag">${esc(t.severity)}</span>` : '') +
    `<span class="ttl">${esc(t.title)}</span>` +
    (t.agent ? `<span class="tag">${esc(t.agent)}</span>` : '') + (t.model ? `<span class="tag">${esc(t.model)}</span>` : '') +
    (t.depends.length ? `<span class="tag">needs ${esc(t.depends.join(', '))}</span>` : '') + '</div>';
}

/** Build the full progress page HTML. */
export function buildHtml({ tickets, names, plan, status, reviews, commits, tags, shots, now }) {
  const done = tickets.filter((t) => t.status === 'done').length;
  const pct = tickets.length ? Math.round((done / tickets.length) * 100) : 0;
  const phase = /\*\*Phase:\*\*\s*(.+)/.exec(status)?.[1].trim().replace(/\*\*/g, '') || 'unknown';
  const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const counts = (ts) => Object.fromEntries(STATUSES.map((s) => [s, ts.filter((t) => t.status === s).length]));

  const msCards = milestoneKeys(tickets, names).map((ms) => {
    const ts = tickets.filter((t) => t.milestone === ms);
    if (!ts.length) return '';
    const c = counts(ts);
    const seg = ['done', 'verify', 'in-progress', 'blocked', 'todo'].map((s) => c[s] ? `<i style="width:${(c[s] / ts.length) * 100}%;background:var(--${s})" title="${s}: ${c[s]}"></i>` : '').join('');
    const chips = STATUSES.filter((s) => c[s]).map((s) => `<span><span class="dot" style="background:var(--${s})"></span>${c[s]} ${s}</span>`).join('');
    return `<div class="card ms"><div class="name">${esc(ms)}</div><div class="sub">${esc(names[ms] || (ms === 'BUG' ? 'Bug fixes' : ''))}</div>` +
      `<div class="pbar">${seg}</div><div class="chips"><span><b>${c.done}/${ts.length}</b> done</span>${chips}</div></div>`;
  }).join('');

  const board = STATUSES.map((s) => {
    const ts = tickets.filter((t) => t.status === s);
    return `<div class="col" style="--st:var(--${s})"><h3>${s}<span>${ts.length}</span></h3>` +
      (ts.map(ticketCard).join('') || '<div class="empty">none</div>') + '</div>';
  }).join('');

  const pillars = renderMarkdown(/(\|\s*Pillar[\s\S]*?)(?=\n\n|\n[^|\n]|$)/.exec(planSection(plan, 1))?.[1] || '_Pillars table not found._');
  const tagLine = tags.length ? `<p>Tags: ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</p>` : '';
  const timeline = commits.length
    ? `<ul class="tl">${commits.map((c) => `<li><span class="h">${esc(c.hash)}</span><span class="d">${esc(c.date)}</span><span class="s">${esc(c.subject)}</span></li>`).join('')}</ul>`
    : '<p class="empty">No commits yet.</p>';
  const gallery = shots.length
    ? `<div class="shots">${shots.map((f) => `<a href="screenshots/${encodeURI(f)}"><img loading="lazy" src="screenshots/${encodeURI(f)}" alt="${esc(f)}">${esc(f)}</a>`).join('')}</div>`
    : '<p class="empty">No screenshots yet.</p>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Tallyman — build progress</title><style>${CSS}</style></head><body>
<header class="c64"><div class="screen">
<div class="l1">**** commodore 64 basic v2 ****</div>
<h1>THE TALLYMAN</h1>
<div class="l1">build progress &middot; autonomous agent build</div>
<div class="meta"><span>Updated <b>${esc(stamp)}</b></span><span>Phase <b>${esc(phase)}</b></span><span>Done <b>${done}/${tickets.length} (${pct}%)</b></span></div>
<div class="bar"><i style="width:${pct}%"></i></div>
<div class="l1 cur">ready.</div>
</div></header>
<main>
<nav><a href="#milestones">Milestones</a><a href="#board">Board</a><a href="#status">Status</a><a href="#plan">Plan</a><a href="#reviews">Reviews</a><a href="#commits">Commits</a><a href="#shots">Screenshots</a></nav>
<section id="milestones"><h2>Milestones</h2><div class="grid">${msCards}</div></section>
<section id="board"><h2>Ticket board</h2><div class="board">${board}</div></section>
<section id="status"><h2>Status</h2><div class="prose">${renderMarkdown(status, 2) || '<p class="empty">No STATUS.md.</p>'}</div></section>
<section id="plan"><h2>Plan summary — pillars</h2>${pillars}</section>
<section id="reviews"><h2>Reviews</h2><div class="prose">${renderMarkdown(reviews, 2) || '<p class="empty">No reviews yet.</p>'}</div></section>
<section id="commits"><h2>Commit timeline</h2>${tagLine}${timeline}</section>
<section id="shots"><h2>Screenshots</h2>${gallery}</section>
</main>
<footer>Generated by <code>npm run progress</code> from tickets, docs and git history.</footer>
</body></html>
`;
}

function main() {
  const plan = read('docs/PLAN.md');
  const names = planMilestones(plan);
  const tickets = loadTickets();
  const shotsDir = join(ROOT, 'docs/screenshots');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => f.endsWith('.png')).sort() : [];
  const html = buildHtml({
    tickets, names, plan, status: read('docs/STATUS.md'), reviews: read('docs/REVIEWS.md'),
    commits: loadCommits(), tags: git(['tag']).split('\n').filter(Boolean), shots, now: new Date(),
  });
  writeFileSync(join(ROOT, 'docs/progress.html'), html);
  writeFileSync(join(ROOT, 'tickets/BOARD.md'), boardMarkdown(tickets, names));
  console.log(`progress: ${tickets.length} tickets, ${tickets.filter((t) => t.status === 'done').length} done -> docs/progress.html, tickets/BOARD.md`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
