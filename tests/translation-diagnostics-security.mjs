// Isolated diagnostics tests; no env files, provider/DB network or real secrets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const logs=[];
let diagnostics;
function load(path,imports={},globals={}) {
 const c={exports:{},require:n=>n==='server-only'?{}:n==='@/lib/translation-diagnostics'?diagnostics:imports[n],...globals};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,c);return c.exports;
}
diagnostics=load('src/lib/translation-diagnostics.ts',{}, {console:{warn:s=>logs.push(JSON.parse(s))}});
const sentinel='PRIVATE_BODY_EMAIL_KEY_TOKEN_UUID';
diagnostics.translationDiagnostic(sentinel,sentinel,sentinel,sentinel);
diagnostics.reportTranslationFailure({message:sentinel,stack:sentinel,name:sentinel},'action');
assert.doesNotMatch(JSON.stringify(logs),new RegExp(sentinel));
const env={OPENAI_API_KEY:sentinel,OPENAI_TRANSLATION_MODEL:'gpt-6-luna'};
let response={ok:false,status:400,json:async()=>({error:{code:'model_not_found',message:sentinel}})};
const adapter=load('src/lib/translation-provider.ts',{}, {process:{env},AbortSignal,fetch:async()=>response});
const input={text:sentinel,sourceLanguage:'ko',targetLanguage:'en'};
for(const[status,code,reason]of [[404,'model_not_found','model_or_access'],[401,'invalid_api_key','authentication'],[429,'insufficient_quota','billing'],[429,'rate_limit_exceeded','rate_limit'],[403,'permission_denied','permission'],[503,sentinel,'provider_error'],[400,'unsupported_parameter','request_rejected']]){
 response={ok:false,status,json:async()=>({error:{code,message:sentinel}})};
 try{await adapter.translationProvider().translateText(input);assert.fail('Must fail');}catch(e){diagnostics.reportTranslationFailure(e,'provider_request');}
 assert.equal(logs.at(-1).reason,reason);assert.equal(logs.at(-1).status,status);
}
for(const[body,reason]of [[{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},'incomplete'],[{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:sentinel}]}]},'refusal'],[{status:'completed',output:[]},'empty_or_oversized'],[{status:'completed',output:null},'invalid_output']]){
 response={ok:true,status:200,json:async()=>body};
 try{await adapter.translationProvider().translateText(input);}catch(e){diagnostics.reportTranslationFailure(e,'provider_request');}
 assert.equal(logs.at(-1).reason,reason);
}
response={ok:true,status:200,json:async()=>{throw Error(sentinel);}};
try{await adapter.translationProvider().translateText(input);}catch(e){diagnostics.reportTranslationFailure(e,'provider_request');}
assert.equal(logs.at(-1).reason,'invalid_json');
diagnostics.reportTranslationFailure({name:'TimeoutError',message:sentinel},'provider_request');assert.equal(logs.at(-1).reason,'timeout');
diagnostics.reportTranslationFailure({name:'TypeError',message:sentinel},'provider_request');assert.equal(logs.at(-1).reason,'network');
delete env.OPENAI_API_KEY;assert.equal(adapter.translationProvider(),null);assert.equal(logs.at(-1).reason,'openai_key_missing');
env.OPENAI_API_KEY=sentinel;delete env.OPENAI_TRANSLATION_MODEL;assert.equal(adapter.translationProvider(),null);assert.equal(logs.at(-1).reason,'model_missing');
env.OPENAI_TRANSLATION_MODEL='bad model ';assert.equal(adapter.translationProvider(),null);assert.equal(logs.at(-1).reason,'model_format_invalid');
let result={error:{code:'42501',message:sentinel},status:403,data:null};
const chain=new Proxy({}, {get:(_,key)=>key==='then'?r=>Promise.resolve(result).then(r):()=>chain});
const cacheEnv={};
const cacheModule=load('src/lib/supabase/translation-cache.ts',{'@/lib/supabase/config':{getSupabaseServerConfig:()=>({url:'http://localhost'})},'@supabase/supabase-js':{createClient:()=>({from:()=>chain,rpc:async()=>result})}},{process:{env:cacheEnv}});
assert.equal(cacheModule.translationCache(),null);assert.equal(logs.at(-1).reason,'cache_secret_missing');
cacheEnv.SUPABASE_TRANSLATION_SECRET_KEY='invalid';assert.equal(cacheModule.translationCache(),null);assert.equal(logs.at(-1).reason,'cache_secret_invalid');
cacheEnv.SUPABASE_TRANSLATION_SECRET_KEY='sb_secret_local_fixture';
const cache=cacheModule.translationCache(),identity={};
for(const[fn,stage]of [[()=>cache.read(identity),'cache_read'],[()=>cache.claim(identity,'fixture','fixture','fixture'),'cache_claim']]){
 try{await fn();}catch(e){diagnostics.reportTranslationFailure(e,stage);}assert.equal(logs.at(-1).stage,stage);assert.equal(logs.at(-1).code,'42501');
}
assert.equal(await cache.finish('fixture','fixture',sentinel),false);assert.equal(logs.at(-1).stage,'cache_finalize');
assert.equal(await cache.finish('fixture','fixture',null),false);assert.equal(logs.at(-1).stage,'cache_release');
result={data:false,error:null,status:200};assert.equal(await cache.finish('fixture','fixture',sentinel),false);assert.equal(logs.at(-1).reason,'zero_rows_or_expired_lease');
assert.doesNotMatch(JSON.stringify(logs),new RegExp(sentinel));
for(const log of logs)assert.ok(Object.keys(log).every(k=>['event','version','stage','reason','status','code'].includes(k)));
assert.ok(logs.every(l=>l.event==='translation.failure'));
console.log('PASS: structured diagnostics for config, model/auth/billing/rate/provider, timeout, output validation, Supabase read/claim/finalize/release; closed-vocabulary redaction. No live calls.');
