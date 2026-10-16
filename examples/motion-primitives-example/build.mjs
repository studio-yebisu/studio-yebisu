import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('assets',{recursive:true});
const result=await build({entryPoints:['src/app.tsx'],bundle:true,minify:true,format:'iife',platform:'browser',target:['safari15','chrome100'],outfile:'assets/app.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},metafile:true,legalComments:'linked',logLevel:'info'});
await writeFile('assets/bundle-meta.json',JSON.stringify(result.metafile,null,2)+'\n');
