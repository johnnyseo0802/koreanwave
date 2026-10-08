// Deterministic clocks and local mocks only. No env files or network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
let now=0,logs=[],throwLogger=false;
const allLogs=[];
const sentinel='PRIVATE_SOURCE_TOKEN_KEY_PROMPT_IDENTIFIER';
const clock={now:()=>now};
const logger={info:s=>{if(throwLogger)throw Error(sentinel);const event=JSON.parse(s);logs.push(event);allLogs.push(event);},warn:()=>{}};
function load(path,imports={},globals={}){
 const context={exports:{},require:n=>n==='server-only'?{}:imports[n],performance:clock,console:logger,...globals};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.exports;
}
const diag=load('src/lib/translation-diagnostics.ts');
const stop=diag.startTranslationTimer('cache_read');now+=12.6;stop();stop();
assert.equal(logs.length,1);assert.equal(logs[0].duration_ms,13);
diag.startTranslationTimer(sentinel)();assert.equal(logs.length,1);
const broken=load('src/lib/translation-diagnostics.ts',{}, {performance:{now:()=>{throw Error(sentinel);}}});
assert.equal(await broken.measureTranslation('cache_read',async()=>42),42);
for(const delta of [-1,NaN,Infinity]){now=0;const finish=diag.startTranslationTimer('cache_read');now=delta;finish();}
assert.equal(logs.length,1);
now=0;const failure=new Error(sentinel);
await assert.rejects(()=>diag.measureTranslation('cache_read',()=>{now+=9;throw failure;}),e=>e===failure);
assert.equal(logs.at(-1).duration_ms,9);
throwLogger=true;assert.equal(await diag.measureTranslation('cache_read',async()=>42),42);
await assert.rejects(()=>diag.measureTranslation('cache_read',async()=>{throw failure;}),e=>e===failure);throwLogger=false;

const shared={'@/lib/translation-diagnostics':diag};
let providerMode='ok';
const provider=load('src/lib/translation-provider.ts',shared,{process:{env:{OPENAI_API_KEY:sentinel,OPENAI_TRANSLATION_MODEL:'fixture-model'}},AbortSignal,fetch:async()=>{
 now+=11;
 if(providerMode==='network')throw failure;
 return {ok:providerMode!=='http',status:providerMode==='http'?503:200,json:async()=>{
  now+=13;
  if(providerMode==='json')throw failure;
  return providerMode==='http'?{error:{message:sentinel}}:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:sentinel}]}]};
 }};
}});
const model=load('src/lib/translation.ts');
const samples={ko:'오늘 날씨는 정말 좋아요',en:'This is my opinion and I like the place.',ja:'これは本当に楽しいですね'};
let source=samples.ko,hit=false,claimState='claimed',hidden=false,finalize=true,auth=true,sourceCalls=0,cacheCalls=0;
const action=load('src/app/community/translation-actions.ts',{
 ...shared,'node:crypto':crypto,'@/lib/translation':model,
 '@/lib/translation-provider':provider,
 '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>{now+=2;return {data:{user:auth?{id:sentinel}:null},error:null};}}})},
 '@/lib/translation-source':{translationSource:async()=>{now+=3;sourceCalls++;return hidden&&sourceCalls>1?null:source;}},
 '@/lib/supabase/translation-cache':{translationCache:()=>({
  read:async()=>{now+=5;cacheCalls++;return hit?sentinel:null;},
  claim:async()=>{now+=7;return {state:claimState,id:sentinel,lease:sentinel,text:sentinel};},
  finish:async()=>{now+=17;return finalize;},
 })},
}).translateConversation;
const req={contentType:'post',contentId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',targetLanguage:'en'};
const stages=()=>logs.map(l=>l.stage);
const reset=()=>{now=0;logs=[];sourceCalls=0;};
for(const [language,text]of Object.entries(samples))for(const target of ['ko','en','ja']){
 if(language===target)continue;
 source=text;hit=false;reset();
 assert.equal((await action({...req,targetLanguage:target})).ok,true);
 assert.deepEqual(stages(),['authentication','source_lookup','cache_read','cache_claim','provider_request','provider_response_processing','source_recheck_before_finalize','cache_finalize','source_recheck_before_delivery','total_request']);
 assert.equal(logs.at(-1).duration_ms,64);
 assert.equal(logs.find(l=>l.stage==='provider_request').duration_ms,11);
 assert.equal(logs.find(l=>l.stage==='provider_response_processing').duration_ms,13);
 hit=true;reset();assert.equal((await action({...req,targetLanguage:target})).ok,true);
 assert.deepEqual(stages(),['authentication','source_lookup','cache_read','source_recheck_before_delivery','total_request']);
 assert.equal(logs.at(-1).duration_ms,13);
}
source=samples.ko;hit=false;
for(const mode of ['network','http','json']){
 providerMode=mode;reset();assert.equal((await action(req)).ok,false);
 assert.ok(stages().includes('provider_request'));assert.ok(stages().includes('cache_release'));
 assert.equal(stages().includes('provider_response_processing'),mode!=='network');
 assert.equal(stages().at(-1),'total_request');
}
providerMode='ok';
for(const state of ['hit','busy','limited']){
 claimState=state;reset();assert.equal((await action(req)).ok,state==='hit');
 assert.ok(!stages().includes('provider_request'));assert.equal(stages().at(-1),'total_request');
}
claimState='claimed';hidden=true;reset();assert.equal((await action(req)).ok,false);assert.ok(stages().includes('cache_release'));hidden=false;
finalize=false;reset();assert.equal((await action(req)).ok,false);assert.ok(stages().includes('cache_finalize'));assert.ok(!stages().includes('source_recheck_before_delivery'));finalize=true;
auth=false;reset();assert.equal((await action(req)).ok,false);assert.deepEqual(stages(),['authentication','total_request']);auth=true;
reset();assert.equal((await action({})).ok,false);assert.deepEqual(stages(),['total_request']);
source='はい';const reads=cacheCalls;reset();assert.equal((await action(req)).ok,false);assert.equal(cacheCalls,reads);assert.equal(stages().at(-1),'total_request');
source=samples.ko;throwLogger=true;assert.equal((await action(req)).ok,true);throwLogger=false;
assert.doesNotMatch(JSON.stringify(allLogs),new RegExp(sentinel));
for(const log of allLogs){assert.deepEqual(Object.keys(log).sort(),['duration_ms','event','stage']);assert.equal(log.event,'translation.duration');assert.ok(Number.isInteger(log.duration_ms)&&log.duration_ms>=0);}
assert.match(fs.readFileSync('src/lib/translation-diagnostics.ts','utf8'),/^import "server-only";/);
assert.doesNotMatch(fs.readFileSync('src/components/translatable-content.tsx','utf8'),/translation-diagnostics|duration_ms/);
console.log('PASS: fixed-stage timing, six pairs cold/cache, provider headers/body split, early exit/failure/cleanup totals, no identifiers/text, logger/clock failure isolation. No live calls.');
