import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {selectedClips,summarize,createExport,serializeExport} from './export.mjs';
const root=new URL('./',import.meta.url);
const data=JSON.parse(readFileSync(new URL('clips.json',root),'utf8'));
const samples=[['all',['c01','c02','c03'],3,370,'06:10'],['two',['c02','c03'],2,275,'04:35'],['one',['c02'],1,190,'03:10']];
const results=[];mkdirSync(new URL('outputs/',root),{recursive:true});
for(const [name,ids,count,seconds,time] of samples){
  assert.deepEqual(summarize(data,ids),{count,seconds,time});
  const output=serializeExport(data,ids,true);const value=JSON.parse(output);
  assert.equal(value.project,data.project);assert.equal(value.schema_version,1);
  assert.deepEqual(value.clips,data.clips.filter(c=>ids.includes(c.id)));
  writeFileSync(new URL('outputs/'+name+'.json',root),output);
  results.push({id:name,input:{ids,include_notes:true},observed:{count,seconds,time},output:'outputs/'+name+'.json',status:'passed'});
}
assert.deepEqual(createExport(data,['c01','c02','c03'],false).clips,data.clips.map(({note,...rest})=>rest));
writeFileSync(new URL('outputs/no-notes.json',root),serializeExport(data,['c01','c02','c03'],false));
results.push({id:'notes-off',status:'passed',notes_present:false,output:'outputs/no-notes.json'});
assert.throws(()=>createExport(data,[],true),RangeError);results.push({id:'empty-rejected',status:'passed'});
assert.deepEqual(summarize(data,[]),{count:0,seconds:0,time:'00:00'});results.push({id:'empty-summary',status:'passed'});
assert.deepEqual(selectedClips(data,['c03','c01','c01','unknown']).map(c=>c.id),['c01','c03']);results.push({id:'input-order-and-duplicates',status:'passed'});
const original=JSON.stringify(data);createExport(data,['c02'],false);assert.equal(JSON.stringify(data),original);results.push({id:'input-immutable',status:'passed'});
writeFileSync(new URL('validation.json',root),JSON.stringify({status:'passed',command:'node verify.mjs',scope:'Actual shared export module and synthetic 3-clip input; UI/motion not tested by this command',conditions:results.length,results},null,2)+'\n');
console.log(JSON.stringify({status:'passed',conditions:results.length,outputs:4}));
