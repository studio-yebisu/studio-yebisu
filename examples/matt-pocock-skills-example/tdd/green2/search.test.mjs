import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchEntries } from './search.mjs';
const entries = JSON.parse(readFileSync(new URL('./entries.json', import.meta.url), 'utf8'));

test('空の検索語は掲載順の全件を返す', () => {
  assert.deepEqual(searchEntries(entries, '').map(entry => entry.id), ['ui-notes','color-lab','slide-story','slide-layout','motion-cards','agent-check']);
});

test('全角の検索語ＵＩは表題かタグにUIを持つ掲載項目を掲載順で返す', () => {
  assert.deepEqual(searchEntries(entries, 'ＵＩ').map(entry => entry.id), ['ui-notes','color-lab','motion-cards']);
});

test('全角空白で区切った検索語UI　設計はすべての語を表題かタグに持つ掲載項目だけを返す', () => {
  assert.deepEqual(searchEntries(entries, 'UI　設計').map(entry => entry.id), ['ui-notes']);
});
