import {selectTasks, addTask, toggleTask} from './tasks.mjs';
const el = id => document.getElementById(id);
let tasks = [];
let nextId = 1;
function showError(message) {el('error').textContent=message;el('error').hidden=!message;}
function showCutoffError(message) {el('cutoff-error').textContent=message;el('cutoff-error').hidden=!message;el('cutoff').setAttribute('aria-invalid',String(!!message));}
function render() {
  let visible;
  try {visible=selectTasks(tasks,{status:el('status').value,cutoff:el('cutoff').value||null});showCutoffError('');}
  catch (error) {
    if (error.message!=='INVALID_CUTOFF') throw error;
    visible=selectTasks(tasks,{status:el('status').value});
    showCutoffError('期限の日付は1000〜9999年の実在する日を入れてください。いまは期限の条件を使わず、状態の絞り込みだけで表示しています。');
  }
  el('cutoff-clear').disabled=!el('cutoff').value;
  el('tasks').replaceChildren();
  for (const task of visible) {
    const item=document.createElement('li');item.dataset.id=task.id;
    const label=document.createElement('label');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=task.done;
    checkbox.addEventListener('change',()=>{tasks=toggleTask(tasks,task.id);render();});
    const name=document.createElement('span');name.textContent=task.title;if(task.done)name.className='done';
    label.append(checkbox,name);
    const date=document.createElement(task.dueDate?'time':'span');date.textContent=task.dueDate||'期限なし';
    if(task.dueDate)date.dateTime=task.dueDate;else date.className='no-date';
    item.append(label,date);el('tasks').append(item);
  }
  el('count').textContent=`${visible.length}件 / 全${tasks.length}件`;
  el('empty').hidden=visible.length>0;
}
el('status').addEventListener('change',render);
el('cutoff').addEventListener('input',render);
el('cutoff-clear').addEventListener('click',()=>{el('cutoff').value='';render();el('cutoff').focus();});
el('add-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {tasks=addTask(tasks,{id:'new-'+nextId,title:el('title').value,dueDate:el('due').value||null});nextId++;el('add-form').reset();showError('');render();el('title').focus();}
  catch {showError('名前を1〜80文字で入力してください。');}
});
try {const response=await fetch('seed.json');if(!response.ok)throw new Error('seed');tasks=await response.json();render();}
catch {showError('作例データを読めませんでした。再読込してください。');}
