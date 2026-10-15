import {summarize,serializeExport} from '../export.mjs';
const data=await fetch('../clips.json').then(r=>r.json());
const list=document.querySelector('#clip-list'),button=document.querySelector('#export');
for(const c of data.clips){
  const row=document.createElement('div');row.className='clip';
  const input=document.createElement('input');input.type='checkbox';input.checked=true;input.value=c.id;input.id='clip-'+c.id;input.setAttribute('aria-label',c.title);
  const info=document.createElement('div');info.className='clip-info';const title=document.createElement('span');title.className='clip-title';title.textContent=c.title;
  const note=document.createElement('p');note.className='clip-note';note.textContent=c.note;info.append(title,note);
  const time=document.createElement('span');time.className='clip-time';time.textContent=summarize(data,[c.id]).time;
  row.append(input,info,time);list.append(row);
}
const ids=()=>[...list.querySelectorAll('input:checked')].map(x=>x.value);
function update(){const s=summarize(data,ids());document.querySelector('#totals').textContent=s.count+'件 / '+s.time;button.disabled=!s.count;button.classList.remove('done');document.querySelector('#status').textContent='';}
list.addEventListener('change',update);document.querySelector('#notes').addEventListener('change',update);
button.addEventListener('click',()=>{const blob=new Blob([serializeExport(data,ids(),document.querySelector('#notes').checked)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='atelier-delivery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);button.classList.add('done');});update();
