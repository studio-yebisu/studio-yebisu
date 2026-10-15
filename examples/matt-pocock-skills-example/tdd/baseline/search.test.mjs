import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchEntries } from './search.mjs';
const entries = JSON.parse(readFileSync(new URL('./entries.json', import.meta.url), 'utf8'));

test('空の検索語は掲載順の全件を返す', () => {
  assert.deepEqual(searchEntries(entries, '').map(entry => entry.id), ['ui-notes','color-lab','slide-story','slide-layout','motion-cards','agent-check']);
});
