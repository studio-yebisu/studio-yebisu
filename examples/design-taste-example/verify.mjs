/** Selected filter acceptance checks. Copyright (c) 2026 Studio Yebisu. MIT. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const site=process.argv[2]?path.resolve(process.argv[2]):path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(await readFile(path.join(site,'events.json'),'utf8'));
const {filterEvents,weekdayJa}=await import(pathToFileURL(path.join(site,'events.mjs')).href);
const events=Object.freeze(data.events.map(e=>Object.freeze({...e})));
const cases=[
 ['all',{},['e01','e02','e03','e04','e05','e06']],
 ['children',{audience:'children'},['e01','e04']],
 ['adults',{audience:'adults'},['e02','e03']],
 ['everyone',{audience:'everyone'},['e05','e06']],
 ['short-story',{query:'短編'},['e02']],
 ['place-is-searched',{query:'読書'},['e01','e02','e05','e06']],
 ['audience-and-query',{audience:'children',query:'短編'},[]],
 ['trim-wide-spaces',{query:'　短編　'},['e02']],
 ['empty-after-normalize',{query:'　 '},['e01','e02','e03','e04','e05','e06']],
 ['no-result',{query:'該当しない語'},[]],
 ['date-is-not-searched',{query:'2026'},[]],
 ['literal-html-query',{query:'<img src=x onerror=alert(1)>'},[]],
];
const checks=cases.map(([name,input,expected])=>{const actual=filterEvents(events,input).map(e=>e.id);assert.deepEqual(actual,expected,name);return {name,input,expected_ids:expected,actual_ids:actual,passed:true};});
const synthetic=Object.freeze([Object.freeze({id:'normalization-only',audience:'adults',title:'ＡＢＣ',description:'d',place:'p'})]);
for(const query of ['abc','　ａｂｃ　']){
 const actual=filterEvents(synthetic,{query}).map(e=>e.id);assert.deepEqual(actual,['normalization-only']);checks.push({name:'synthetic-nfkc-lowercase-'+checks.length,input:{query},expected_ids:['normalization-only'],actual_ids:actual,passed:true,synthetic:true});
}
const split=Object.freeze([Object.freeze({id:'field-boundary',audience:'adults',title:'ab',description:'cd',place:'ef'})]);
const crossing=filterEvents(split,{query:'bc'}).map(e=>e.id);assert.deepEqual(crossing,[]);checks.push({name:'no-cross-field-substring',input:{query:'bc'},expected_ids:[],actual_ids:crossing,passed:true,synthetic:true});
for(const [i,expected] of ['土','金','土','土','日','土'].entries()){
 const actual=weekdayJa(events[i].date);assert.equal(actual,expected);checks.push({name:'fixed-calendar-'+events[i].id,input:{date:events[i].date},expected_weekday:expected,actual_weekday:actual,passed:true});
}
const hashes={};for(const name of ['events.json','events.mjs','app.mjs'])hashes[name]=createHash('sha256').update(await readFile(path.join(site,name))).digest('hex');
const presets=[['all',{audience:'all',query:''}],['children',{audience:'children',query:''}],['reading',{audience:'all',query:'短編'}]].map(([id,input])=>({id,input,count:filterEvents(events,input).length,event_ids:filterEvents(events,input).map(e=>e.id)}));
const report={scope:'Selected pure filter semantics, six fixed calendar weekdays, source/data hash and input immutability; browser appearance, accessibility and human approval are separate.',node_version:process.version,source_sha256:hashes,checks,passed:checks.length,failed:0,human_approval:false};
await writeFile(path.join(site,'validation.json'),JSON.stringify(report,null,2)+'\n','utf8');
await writeFile(path.join(site,'results.json'),JSON.stringify({scope:'Saved actual execution of the same filterEvents module used by the page',node_version:process.version,source_sha256:hashes,presets},null,2)+'\n','utf8');
process.stdout.write(JSON.stringify({passed:checks.length,failed:0,results:presets})+'\n');
