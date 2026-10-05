// Server actions and DAL with local mocks. Real RLS tests are conversation-db-security.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
function load(path,imports={}){const ctx={exports:{},FormData,require:n=>n==='server-only'?{}:imports[n]};vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;}
const model=load('src/lib/conversation.ts'),community=load('src/lib/community.ts');
for(const value of ['',null,{},'x','x'.repeat(2001),' \n '])assert.ok(model.commentError(value));
for(const value of [' hi ','😀😀','x'.repeat(2000),'<script>alert(1)</script>'])assert.equal(model.commentError(value),null,'Plain text accepted, escaped by React');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let calls=[],authenticated=false,admin=false,allowed=true,result={data:{id},error:null};
const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve(result).then(resolve):(...args)=>{calls.push([key,...args]);return chain;}});
const client={auth:{getUser:async()=>({data:{user:authenticated?{id:'server-verified-user'}:null},error:null})},from:table=>{calls.push(['from',table]);return chain;},rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:allowed,error:null};}};
const imports={'@/lib/conversation':model,'@/lib/community':community,'@/lib/supabase/server':{createClient:async()=>client},'next/cache':{revalidatePath(){}},'@/lib/auth/admin-access':{getAdminAccess:async()=>admin?{status:'admin',client}:{status:'forbidden'}}};
const actions=load('src/app/community/conversation-actions.ts',imports),moderation=load('src/app/admin/conversations/actions.ts',imports);
const form=new FormData();for(const[k,v]of Object.entries({body:'Valid comment',author_id:'forged',status:'approved',published_at:'forged',post_id:'forged',role:'admin',parent_comment_id:'forged'}))form.set(k,v);
assert.equal((await actions.submitComment(id,null,form)).ok,false);assert.equal(calls.length,0);
authenticated=true;
assert.equal((await actions.submitComment(id,null,form)).ok,true);
assert.deepEqual(Object.keys(calls.find(c=>c[0]==='insert')[1]).sort(),['body','parent_comment_id','post_id']);
assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='status'&&c[2]==='approved'));
calls=[];assert.equal((await actions.submitComment(id,id,form)).ok,true);
assert.ok(calls.some(c=>c[0]==='is'&&c[1]==='parent_comment_id'&&c[2]===null));
assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='post_id'&&c[2]===id));
form.set('body',' ');calls=[];assert.equal((await actions.submitComment(id,null,form)).ok,false);assert.equal(calls.length,0);form.set('body','Valid body');
result={data:null,error:null};calls=[];assert.equal((await actions.submitComment(id,null,form)).ok,false);assert.ok(!calls.some(c=>c[0]==='insert'));
result={data:null,error:{message:'SECRET_DATABASE_TEXT'}};assert.doesNotMatch(JSON.stringify(await actions.submitComment(id,null,form)),/SECRET_DATABASE_TEXT/);
result={data:{id},error:null};calls=[];
assert.equal((await actions.reactToPost(id,'like',true)).ok,true);
assert.deepEqual(Object.keys(calls.find(c=>c[0]==='insert')[1]).sort(),['post_id','reaction_type']);
calls=[];assert.equal((await actions.reactToPost(id,'agree',false)).ok,true);
assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='reaction_type'&&c[2]==='agree'));
allowed=false;calls=[];assert.equal((await actions.reactToPost(id,'like',true)).ok,false);assert.ok(!calls.some(c=>c[0]==='insert'));
assert.equal((await actions.reactToPost(id,'forged',true)).ok,false);
const report=new FormData();report.set('reason','harassment');report.set('details','A local report');
calls=[];assert.equal((await actions.reportComment(id,id,report)).ok,true);
assert.deepEqual(Object.keys(calls.find(c=>c[0]==='insert')[1]).sort(),['comment_id','details','post_id','reason']);
report.set('reason','forged');assert.equal((await actions.reportComment(id,id,report)).ok,false);
form.set('title','Operator prompt');
calls=[];for(const fn of [()=>moderation.createDiscussion(form),()=>moderation.moderateComment(id,'pending','approved'),()=>moderation.hideConversationPost(id)])assert.equal((await fn()).ok,false);
assert.equal(calls.length,0);
admin=true;calls=[];assert.equal((await moderation.createDiscussion(form)).ok,true);
const payload=calls.find(c=>c[0]==='insert')[1];assert.deepEqual(Object.keys(payload).sort(),['author_id','body','title','type']);assert.equal(payload.author_id,'server-verified-user');assert.equal(payload.type,'discussion');
for(const from of ['pending','approved']){calls=[];assert.equal((await moderation.moderateComment(id,from,'rejected')).ok,true);assert.deepEqual(Object.keys(calls.find(c=>c[0]==='update')[1]),['status']);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='status'&&c[2]===from));}
assert.equal((await moderation.moderateComment(id,'rejected','approved')).ok,false);
assert.equal((await moderation.moderateComment(id,'approved','approved')).ok,false);
result={data:null,error:null};assert.equal((await moderation.moderateComment(id,'pending','approved')).ok,false);assert.equal((await moderation.hideConversationPost(id)).ok,false);
// Admin/author public page reads still explicitly constrain status and roots.
const queries=load('src/lib/conversation-data.ts',imports);
result={data:[],error:null};client.rpc=async()=>({data:[],error:null});calls=[];
const data=await queries.conversationData(id);assert.equal(data.unavailable,false);
assert.ok(calls.filter(c=>c[0]==='eq'&&c[1]==='status'&&c[2]==='approved').length>=2);
assert.ok(calls.some(c=>c[0]==='order'&&c[1]==='created_at'&&c[2].ascending===false),'Newest bounded window includes newly posted comments');
for(const c of calls.filter(c=>c[0]==='select'))assert.doesNotMatch(c[1],/author_id|member_id|reporter_id|profiles|\*/);
calls=[];await queries.articleConversation(id);for(const field of ['article.status','post.status','post.type'])assert.ok(calls.some(c=>c[0]==='eq'&&c[1]===field));
assert.equal((await queries.trendingConversations()).length,0);
client.rpc=async()=>({data:null,error:{message:'PRIVATE_ERROR'}});assert.equal(await queries.trendingConversations(),null);
for(const path of ['src/components/conversation.tsx','src/components/conversation-controls.tsx','src/components/conversation-admin.tsx','src/app/admin/conversations/page.tsx', 'src/app/community/conversation-actions.ts']){
 const source=read(path);assert.doesNotMatch(source,/dangerouslySetInnerHTML|service_role|SECRET_KEY|console\.|\.select\(["']\*/);
}
assert.match(read('src/components/conversation-controls.tsx'),/lock\.current/);
assert.match(read('src/app/admin/conversations/page.tsx'),/access\.status !== "admin"\) notFound/);
console.log('PASS: Sprint 9 actions/DAL authorization, identity whitelist, independent validation, public context filters, own reactions, admin zero rows, empty/error states, private-column and unsafe-HTML source checks. No network.');
