// Offline action contracts. No environment files, remote calls or user content.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,imports={}){const ctx={exports:{},FormData,require:n=>n==='server-only'?{}:imports[n]};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;}
const policy=load('src/lib/publication-policy.ts'),community=load('src/lib/community.ts');
const model=load('src/lib/member-content.ts',{'@/lib/community':community,'@/lib/publication-policy':policy});
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let signed=false,admin=false,error=false,calls=[];
const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve({data:{id},error:null}).then(resolve):(...args)=>{calls.push([key,...args]);return chain;}});
const client={auth:{getUser:async()=>({data:{user:signed?{id:'verified-owner'}:null},error:null})},from:()=>chain,rpc:async(name,args)=>{calls.push([name,args]);return{data:null,error:error?{message:'PRIVATE_RAW_ERROR'}:null};}};
const deps={'@/lib/publication-policy':policy,'@/lib/community':community,'@/lib/member-content':model,'@/lib/supabase/server':{createClient:async()=>client},'@/lib/auth/admin-access':{getAdminAccess:async()=>admin?{status:'admin',client}:{status:'forbidden'}},'next/cache':{revalidatePath(){}}};
const actions=load('src/app/community/policy-actions.ts',deps);
assert.equal((await actions.reportMemberPolicy('post',id,'spam')).ok,false);assert.equal(calls.length,0);
assert.equal((await actions.reviewMemberPolicy('post',id,'1','suspend','spam')).ok,false);assert.equal(calls.length,0);
assert.equal((await actions.clearWritingRestriction(id,'1')).ok,false);assert.equal(calls.length,0);
signed=true;
for(const reason of ['commercial','spam','abuse','privacy','illegal','other'])assert.equal((await actions.reportMemberPolicy('post',id,reason)).ok,true);
for(const args of [['other',id,'spam'],['post','bad','spam'],['post',id,'private arbitrary text']])assert.equal((await actions.reportMemberPolicy(...args)).ok,false);
admin=true;
assert.equal((await actions.clearWritingRestriction(id,'1')).ok,true);
assert.equal((await actions.clearWritingRestriction('invalid','1')).ok,false);
assert.equal((await actions.clearWritingRestriction(id,'0')).ok,false);
for(const kind of ['post','question','answer','review','comment'])for(const action of ['approve','hide','keep','restore','warn','restrict','suspend']){
 calls=[];assert.equal((await actions.reviewMemberPolicy(kind,id,'2',action,'false_positive')).ok,true);
 assert.equal(calls[0][0],'review_member_policy');assert.equal(calls[0][1].expected_revision,'2');
 assert.deepEqual(Object.keys(calls[0][1]).sort(),['action','expected_revision','kind','reason','target']);
}
for(const rev of ['','0','-1','1.5','9007199254740993'])assert.equal((await actions.reviewMemberPolicy('post',id,rev,'hide','spam')).ok,false);
error=true;assert.doesNotMatch(JSON.stringify(await actions.reviewMemberPolicy('post',id,'1','hide','spam')),/PRIVATE_RAW_ERROR/);error=false;
// All question/answer/review Actions forward only disclosure and whitelisted
// content; DB owns status. Existing form identity/moderation fields are ignored.
for(const [file,fn,validation] of [
 ['src/app/write/question/actions.ts','submitQuestion',{'@/lib/questions':load('src/lib/questions.ts')}],
 ['src/lib/submit-answer.ts','submitAnswer',{'@/lib/answers':load('src/lib/answers.ts')}],
 ['src/lib/submit-review.ts','submitReview',{'@/lib/reviews':load('src/lib/reviews.ts')}],
]){
 const action=load(file,{...deps,...validation})[fn];
 for(const disclosure of ['personal','commercial','false','']){
  const form=new FormData();for(const[k,v]of Object.entries({title:'A genuine question',body:'A genuine sufficiently detailed personal contribution.',commercial_disclosure:disclosure,author_id:'forged',status:'approved',edited_at:'forged'}))form.set(k,v);
  calls=[];assert.equal((await (fn==='submitQuestion'?action(form):action(id,form))).ok,true);
  const insert=calls.find(c=>c[0]==='insert')[1];assert.equal(insert.commercial_disclosure,['personal','commercial'].includes(disclosure)?disclosure:'unspecified');
  assert.equal(insert.author_id,'verified-owner');for(const key of ['status','edited_at','published_at','revision'])assert.equal(key in insert,false);
 }
}
console.log('PASS: policy action auth/admin/CAS/reason gates, safe errors, five content-kind review contracts, all submission disclosure whitelists and omitted/forged fail-closed classification. Offline only.');
