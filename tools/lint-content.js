// Stub content linter (TT-001). Real checks arrive with the content schema.
import { content } from '../src/content/index.js';

const strict = process.argv.includes('--strict'); // no-op for now
void strict;

const errors = [];
if (!content || typeof content !== 'object') errors.push('content bundle is not an object');
else for (const k of ['rooms', 'items', 'npcs']) {
  if (!content[k] || typeof content[k] !== 'object' || Array.isArray(content[k])) errors.push(`content.${k} must be an object`);
}
if (errors.length) { for (const e of errors) console.error('lint:content ERROR', e); process.exit(1); }
console.log('lint:content OK (stub)');
