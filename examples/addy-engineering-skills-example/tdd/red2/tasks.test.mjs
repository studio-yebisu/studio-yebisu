import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectTasks, addTask, toggleTask} from './tasks.mjs';
const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));

test('未完了を選ぶと既存の並び順で4件が返る', () => {
  assert.deepEqual(selectTasks(seed, {status:'open'}).map(task=>task.id), ['proposal','sample','publish','idea']);
});
test('追加したTODOは空白を除いた名前になり完了を切り替えられる', () => {
  const added = addTask(seed, {id:'new', title:'  展示を見る  '});
  const toggled = toggleTask(added, 'new');
  assert.deepEqual(toggled.at(-1), {id:'new', title:'展示を見る',dueDate:null,done:true});
  assert.equal(seed.length, 6);
});
test('空の名前は既存どおり拒む', () => {
  assert.throws(()=>addTask(seed,{id:'new',title:'  '}), {name:'RangeError',message:'INVALID_TITLE'});
});
test('未完了で期限2026-10-15までを選ぶと当日を含み翌日以降と期限なしを除いた2件が返る', () => {
  assert.deepEqual(selectTasks(seed, {status:'open', cutoff:'2026-10-15'}).map(task=>task.id), ['proposal','sample']);
});
test('実在しない期限2026-02-30を指定するとINVALID_CUTOFFのRangeErrorで拒む', () => {
  assert.throws(()=>selectTasks(seed,{status:'all',cutoff:'2026-02-30'}), {name:'RangeError',message:'INVALID_CUTOFF'});
});
