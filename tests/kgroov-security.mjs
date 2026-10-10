// Presentation regression using isolated component dependencies. No network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as runtime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
const read = p => fs.readFileSync(p, 'utf8');
let failure=false, empty=false, calls=[];
const article={id:'safe-fixture',title:'<script>unsafe</script>',summary:'A published story',category:'music',published_at:'2026-10-10'};
const context={exports:{},require:n=>({
  'react/jsx-runtime':runtime,
  'next/link':{default:({href,children,...props})=>runtime.jsx('a',{href,...props,children})},
  '@/components/content-image':{ContentImage:()=>null},
  '@/lib/editorial-data':{listPublicArticles:async(section,category,limit)=>{calls.push({section,category,limit});return failure?null:empty?[]:[{...article,category:category??'music'}];}},
  '@/lib/conversation-data':{trendingConversations:async()=>failure?null:empty?[]:[{post:{id:'public-fixture',type:'moment',title:null,body:'<img src=x onerror=unsafe>'},stat:{comments:4,reactions:7}}]},
})[n]};
vm.runInNewContext(ts.transpileModule(read('src/components/home-editorial.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {HomeEditorial,HomeConversations}=context.exports;
let html=renderToStaticMarkup(await HomeEditorial({}));
assert.match(html,/Trending Now/);assert.match(html,/Latest published/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
assert.ok(calls.every(c=>c.limit===3));
calls=[];html=renderToStaticMarkup(await HomeEditorial({lifestyle:true}));
assert.deepEqual(calls.map(c=>[c.section,c.category]),[['k-trends','beauty'],['k-trends','fashion']]);
html=renderToStaticMarkup(await HomeConversations());assert.match(html,/4 comments &amp; replies · 7 reactions/);assert.match(html,/Korea Moment/);assert.doesNotMatch(html,/<img/);assert.match(html,/community\/posts\/public-fixture/);
empty=true;assert.match(renderToStaticMarkup(await HomeConversations()),/No public conversations/);assert.match(renderToStaticMarkup(await HomeEditorial({})),/New stories are on the way/);
failure=true;assert.match(renderToStaticMarkup(await HomeConversations()),/couldn’t load/);assert.match(renderToStaticMarkup(await HomeEditorial({})),/couldn’t load/);
assert.match(read('src/lib/editorial-data.ts'),/\.eq\("status", "published"\)/);
assert.match(read('src/lib/conversation-data.ts'),/\.eq\("status", "approved"\)/);
assert.doesNotMatch(read('src/components/home-editorial.tsx'),/service_role|secret|author_id|dangerouslySetInnerHTML|\.insert\(|\.update\(/);
assert.match(read('src/app/layout.tsx'),/https:\/\/koreanwave-kappa.vercel.app/);
assert.match(read('src/lib/public-metadata.ts'),/https:\/\/koreanwave-kappa.vercel.app/);
console.log('PASS: KGROOV real-data adapters, bounded reads, truthful labels/counts, lifestyle categories, empty/error states, escaped text, canonical origin retained. Offline only.');
