import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../../src/content/index.js';

test('content bundle has rooms, items, npcs objects', () => {
  for (const k of ['rooms', 'items', 'npcs']) {
    assert.equal(typeof content[k], 'object');
    assert.ok(content[k] !== null && !Array.isArray(content[k]));
  }
});
