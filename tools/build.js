// Single-file offline build: bundle src/ui/main.js and inline into src/index.html -> dist/tallyman.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = process.argv.includes('--release');

const result = await build({
  entryPoints: [resolve(root, 'src/ui/main.js')],
  bundle: true,
  format: 'iife',
  minify: release,
  sourcemap: false,
  write: false,
  target: 'es2022',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const tpl = readFileSync(resolve(root, 'src/index.html'), 'utf8');
const tag = /<script\b[^>]*\bsrc="\.\/ui\/main\.js"[^>]*><\/script>/;
if (!tag.test(tpl)) { console.error('build: script tag for ./ui/main.js not found in src/index.html'); process.exit(1); }
const html = tpl.replace(tag, () => `<script>\n${js}</script>`);

const out = resolve(root, 'dist/tallyman.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`build: wrote dist/tallyman.html (${html.length} bytes${release ? ', release' : ''})`);
