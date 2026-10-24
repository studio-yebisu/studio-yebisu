import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chat, toolDefinition} from '@tanstack/ai';
import {claudeCodeText} from '@tanstack/ai-claude-code';
import {defineSandbox, defineWorkspace, withSandbox} from '@tanstack/ai-sandbox';
import {localProcessSandbox} from '@tanstack/ai-sandbox-local-process';
import {z} from 'zod';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'out', new Date().toISOString().replace(/[:.]/g, '-'));
await fs.mkdir(out, {recursive:true});
const safeWorkspace = path.join(out, 'empty-workspace');
await fs.mkdir(safeWorkspace);
const products = [
  {id:'mug-blue', name:'青いマグカップ', price:1800, color:'blue'},
  {id:'mug-red', name:'赤いマグカップ', price:2200, color:'red'},
  {id:'tumbler-steel', name:'ステンレスタンブラー', price:3200, color:'silver'},
];
const inputSchema = z.object({query:z.string(), maxPrice:z.number().optional()});
const outputSchema = z.object({products:z.array(z.object({id:z.string(),name:z.string(),price:z.number(),color:z.string()}))});
let executions=[];
const getProducts = toolDefinition({
  name:'get_products', description:'架空の商品カタログ3件を読み取り検索します。queryにはblue、red、mug、tumbler、allを指定できます。maxPriceは円単位の上限です。',
  inputSchema, outputSchema,
}).server(async input => {
  const parsed=inputSchema.parse(input);
  const q=parsed.query.toLowerCase();
  const matches=products.filter(p=>(q==='all'||p.id.includes(q)||p.name.includes(q)||p.color===q) && (parsed.maxPrice===undefined||p.price<=parsed.maxPrice));
  const result=outputSchema.parse({products:matches});
  executions.push({input:parsed,output:result});
  return result;
});
const sandbox=defineSandbox({
  id:'yaoyorozu-typed-products',
  provider:localProcessSandbox({dir:safeWorkspace,removeOnDestroy:false,scrubEnv:['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN']}),
  workspace:defineWorkspace({source:{type:'none'},instructions:'Only use the provided read-only get_products tool. Do not read or change files or execute commands.'}),
  fileEvents:false,
});
const tests=[
  {id:'blue-mug',label:'青いマグを探す',prompt:'青いマグカップを探しています。get_productsをquery="blue"で実際に呼び出し、取得した名前と価格を日本語で短く答えてください。',expected:['mug-blue']},
  {id:'budget',label:'予算内を探す',prompt:'予算は2500円です。get_productsをquery="all", maxPrice=2500で実際に呼び出し、予算内の商品名と価格を日本語で短く教えてください。',expected:['mug-blue','mug-red']},
];
const samples=[];
for(const test of tests){
  executions=[];
  const events=[];
  const start=performance.now();
  console.log('Running',test.id);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(new Error('Run exceeded 120 seconds')), 120000);
  timeout.unref();
  const stream=chat({
    adapter:claudeCodeText('claude-opus-5-5',{
      cwd:safeWorkspace, authMode:'host', permissionMode:'acceptEdits', allowedTools:['mcp__tanstack__get_products'], settingSources:[], maxTurns:5, emitDiff:false,
      claudeExecutable:process.env.CLAUDE_EXE||'claude',
    }),
    messages:[{role:'user',content:test.prompt}],
    systemPrompts:['これは架空の商品だけを使うSDK実演です。ファイルやシェルは使わず、渡されたget_productsだけを呼んでください。結果に存在しない情報を補わず、回答は2文以内。'],
    threadId:'yaoyorozu-'+test.id+'-'+Date.now(),
    tools:[getProducts], toolChoice:{type:'tool',name:'get_products'},
    middleware:[withSandbox(sandbox)],
    abortController,
  });
  try {
    for await(const event of stream){
      events.push({seconds:(performance.now()-start)/1000,...event});
      if(event.type==='RUN_ERROR') console.error('RUN_ERROR',event.message);
    }
  } finally {
    clearTimeout(timeout);
  }
  await fs.writeFile(path.join(out,test.id+'-events.json'),JSON.stringify(events,null,2));
  const ids=executions.flatMap(e=>e.output.products.map(p=>p.id));
  if(!test.expected.every(id=>ids.includes(id))) throw new Error('Real tool execution did not return expected products: '+test.id);
  if(events.some(e=>e.type==='RUN_ERROR')) throw new Error('SDK emitted an error: '+test.id);
  const text=events.filter(e=>e.type==='TEXT_MESSAGE_CONTENT').map(e=>e.delta??'').join('');
  samples.push({...test,text,executions:structuredClone(executions),events:events.filter(e=>!['CUSTOM','RAW'].includes(e.type)),durationSeconds:(performance.now()-start)/1000});
  console.log('Passed',test.id,JSON.stringify({ids,text,eventTypes:[...new Set(events.map(e=>e.type))]}));
}
const report={sdk:'@tanstack/ai',version:'1.0.0',model:'claude-opus-5-5',adapter:'@tanstack/ai-claude-code@1.0.0',connection:'Existing Claude Code host login; no API key injected',node:process.version,scope:'Live model inference and real read-only TanStack server tool execution. Public page replays recorded output; it does not run a model in the browser.',products,samples};
await fs.writeFile(path.join(out,'runtime-results.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(root,'out','latest-run.json'),JSON.stringify({out,results:path.join(out,'runtime-results.json')},null,2)+'\n');
console.log('RESULTS',path.join(out,'runtime-results.json'));
