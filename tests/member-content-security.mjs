// Offline action and cleanup fault injection. No provider, environment files or DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,imports={},globals={}){const ctx={exports:{},FormData,AbortSignal,require:n=>n==='server-only'?{}:imports[n],...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;}
const community=load('src/lib/community.ts');
const model=load('src/lib/member-content.ts',{'@/lib/community':community,'@/lib/publication-policy':load('src/lib/publication-policy.ts')});
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let authenticated=false,own=true,error=false,cleanup=true,verification=true,calls=[],providerCalls=0,cleanupCalls=0;
const item={id,kind:'post',type:'moment',title:null,body:'Original caption',revision:1,status:'approved',image_id:null,youtube_video_id:'abcdefghijk',youtube_title:'Verified old title',youtube_channel_name:'Verified old channel'};
let receipt={id,status:'pending',changed:true,cleanup_pending:false};
const client={auth:{getUser:async()=>({data:{user:authenticated?{id:'server-authenticated-user'}:null},error:null})},rpc:async(name,args)=>{
 calls.push({name,args});if(name==='my_manageable_content')return{data:own?[item]:[],error:null};return error?{data:null,error:{message:'SENSITIVE_ERROR'}}:{data:receipt,error:null};
}};
const actions=load('src/app/community/member-actions.ts',{
 '@/lib/community':community,'@/lib/member-content':model,'next/cache':{revalidatePath(){}},
 '@/lib/supabase/server':{createClient:async()=>client},'@/lib/auth/admin-access':{getAdminAccess:async()=>({status:'forbidden'})},
 '@/lib/verify-member-video':{verifyMemberVideo:async()=>{providerCalls++;return verification?{title:'Verified new title',channel:'Verified new channel'}:null;}},
 '@/lib/member-media-cleanup':{cleanupRetiredMedia:async()=>{cleanupCalls++;return cleanup;}},
});
const form=new FormData();for(const[k,v]of Object.entries({body:'New caption',youtube_video_id:'abcdefghijk',edited_at:'forged',author_id:'forged',status:'approved',revision:'9'}))form.set(k,v);
assert.equal((await actions.editMemberContent('post',id,'1',form)).ok,false);assert.equal(calls.length,0);
authenticated=true;own=false;assert.equal((await actions.editMemberContent('post',id,'1',form)).ok,false);assert.equal(calls.filter(c=>c.name==='manage_member_content').length,0);
own=true;calls=[];assert.equal((await actions.editMemberContent('post',id,'2',form)).ok,false);assert.equal(calls.length,1);
calls=[];assert.equal((await actions.editMemberContent('post',id,'1',form)).ok,true);
const patch=calls.find(c=>c.name==='manage_member_content').args.patch;
for(const key of ['edited_at','author_id','status','revision','published_at'])assert.equal(key in patch,false);
assert.equal(providerCalls,0,'Unchanged YouTube metadata is preserved without another provider request');
form.set('youtube_video_id','lmnopqrstuv');verification=false;calls=[];assert.equal((await actions.editMemberContent('post',id,'1',form)).ok,false);assert.equal(calls.filter(c=>c.name==='manage_member_content').length,0);
verification=true;assert.equal((await actions.editMemberContent('post',id,'1',form)).ok,true);assert.equal(calls.at(-1).args.patch.youtube_title,'Verified new title');
error=true;assert.doesNotMatch(JSON.stringify(await actions.editMemberContent('post',id,'1',form)),/SENSITIVE_ERROR/);
assert.equal((await actions.deleteMemberContent('post',id,'1')).ok,false);assert.equal(cleanupCalls,0);
error=false;receipt={id,status:'deleted',cleanup_pending:false};assert.equal((await actions.deleteMemberContent('post',id,'1')).ok,true);assert.equal(cleanupCalls,0,'YouTube-only deletion needs no cleanup');
receipt.cleanup_pending=true;cleanup=false;assert.equal((await actions.deleteMemberContent('post',id,'1')).cleanupPending,true);
cleanup=true;assert.equal((await actions.deleteMemberContent('post',id,'1')).cleanupPending,false);
assert.equal((await actions.retryMemberMedia(id)).ok,false,'Admin guard');
for(const kind of ['question','answer','review','comment']){const f=new FormData();f.set('body','😀😀');f.set('title','A title');assert.equal(!!model.editInput({...item,kind},f).error,kind==='question');}
let removed=false,removeFails=false,infoFailure=null,ackFails=false,ackCount=0;
const storageClient={rpc:async(name,args)=>{
 assert.equal(name,'member_media_cleanup');assert.equal(args.target,id);
 if(args.completed){ackCount++;assert.equal(args.completed,id);return ackFails?{error:{},data:null}:{error:null,data:[]};}
 return{error:null,data:removed&&ackCount&&!ackFails?[]:[{image_id:id}]};
},storage:{from:bucket=>{assert.equal(bucket,'community-media');return{
 remove:async paths=>{assert.deepEqual(Array.from(paths),[id+'/image.webp']);if(removeFails)return{error:{}};removed=true;return{data:[],error:null};},
 info:async()=>infoFailure?{data:null,error:infoFailure}:removed?{data:null,error:{code:'NoSuchKey',status:404}}:{data:{id},error:null},
};}}};
const cleanupModule=load('src/lib/member-media-cleanup.ts',{'@supabase/supabase-js':{createClient:()=>storageClient},'@/lib/community':community,'@/lib/supabase/config':{getSupabaseServerConfig:()=>({url:'http://127.0.0.1'})}}, {process:{env:{SUPABASE_COMMUNITY_MEDIA_SECRET_KEY:'sb_secret_SYNTHETIC_TEST_ONLY'}}});
removeFails=true;assert.equal(await cleanupModule.cleanupRetiredMedia(id),false);assert.equal(ackCount,0);
removeFails=false;
for(const failure of [{},{status:400,code:'AccessDenied'},{status:404,code:'NoSuchBucket'},{status:404},{status:500,code:'NoSuchKey'}]){
 infoFailure=failure;assert.equal(await cleanupModule.cleanupRetiredMedia(id),false);assert.equal(ackCount,0,'Unconfirmed absence never acknowledged');
}
infoFailure=null;ackFails=true;assert.equal(await cleanupModule.cleanupRetiredMedia(id),false);
ackFails=false;removed=false;ackCount=0;assert.equal(await cleanupModule.cleanupRetiredMedia(id),true);assert.equal(ackCount,1);
assert.equal(await cleanupModule.cleanupRetiredMedia(id),true,'Duplicate cleanup is safe');
console.log('PASS: authenticated owner/CAS action gates; forged fields excluded; YouTube verification failure; no-image deletion; safe errors; durable cleanup failure/absence/ack/retry; moderator denial. Offline only.');
