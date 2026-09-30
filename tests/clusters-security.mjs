// Offline static + executable query/action mocks. No env, remote DB or credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
function load(path,imports={}){const ctx={exports:{},FormData,Date,require:n=>n==='server-only'?{}:imports[n]};vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;}
const model=load('src/lib/clusters.ts'),editorial=load('src/lib/editorial.ts');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',privateId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const form=new FormData();for(const[k,v]of Object.entries({slug:'seongsu',title:'Seongsu',summary:'A practical discovery topic.',introduction:'A considerate guide to exploring a neighborhood.',status:'draft',display_order:'0',published_at:'forged',role:'admin'}))form.set(k,v);
assert.ok(model.validateCluster(form).value);assert.deepEqual(Object.keys(model.validateCluster(form).value).sort(),['display_order','introduction','slug','status','summary','title']);
for(const slug of ['//evil','UPPER','a--b','../draft','x','a'.repeat(81)]){form.set('slug',slug);assert.ok(model.validateCluster(form).error);}form.set('slug','seongsu');
for(const value of ['-1','10000','NaN','1.5',''])assert.equal(model.orderValue(value),null);
let calls=[],reply={data:{id,updated_at:'2026-09-30T00:00:00Z'},error:null};
const chain=new Proxy({}, {get:(_,name)=>name==='then'?resolve=>Promise.resolve(reply).then(resolve):(...args)=>{calls.push([name,...args]);return chain;}});
const client={from:table=>{calls.push(['from',table]);return chain;}};
let access={status:'forbidden'};
const actions=load('src/app/admin/clusters/actions.ts',{'@/lib/auth/admin-access':{getAdminAccess:async()=>access},'@/lib/editorial':editorial,'@/lib/clusters':model,'next/cache':{revalidatePath(){}}});
for(const action of [()=>actions.saveCluster(null,null,form),()=>actions.saveClusterLink(id,null,form),()=>actions.saveClusterPrompt(id,null,form),()=>actions.removeClusterEntry(id,id,'item')])assert.equal((await action()).ok,false);assert.equal(calls.length,0);
access={status:'admin',client};assert.equal((await actions.saveCluster(null,null,form)).ok,true);assert.equal(calls.find(c=>c[0]==='insert')[1].published_at,undefined);
calls=[];assert.equal((await actions.saveCluster(id,'2026-09-29T00:00:00Z',form)).ok,true);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'));
reply={data:null,error:null};assert.equal((await actions.saveCluster(id,'2026-09-29T00:00:00Z',form)).ok,false);
reply={data:null,error:{code:'23505',message:'RAW PRIVATE DATABASE ERROR'}};assert.doesNotMatch((await actions.saveCluster(null,null,form)).message,/RAW/);
reply={data:{id},error:null};form.set('target','question_id');form.set('target_id',id);calls=[];assert.equal((await actions.saveClusterLink(id,null,form)).ok,true);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='status'&&c[2]==='approved'));assert.deepEqual(Object.keys(calls.find(c=>c[0]==='insert')[1]).sort(),['cluster_id','display_order','question_id']);
calls=[];assert.equal((await actions.saveClusterLink(id,id,form)).ok,true);assert.deepEqual(Object.keys(calls.find(c=>c[0]==='update')[1]),['display_order']);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='cluster_id'));
form.set('kind','question');form.set('prompt','What should a visitor consider?');assert.equal((await actions.saveClusterPrompt(id,null,form)).ok,true);form.set('kind','admin');assert.equal((await actions.saveClusterPrompt(id,null,form)).ok,false);
reply={data:null,error:null};assert.equal((await actions.removeClusterEntry(id,id,'item')).ok,false);assert.equal((await actions.removeClusterEntry(id,id,'profiles')).ok,false);

// Simulate broad admin/own RLS visibility: only the application's explicit filters
// remove private targets. Six real target shapes, not pre-filtered public fixtures.
let clusterStatus='published',fail=false;
const privacyCalls=[];
const privacyClient={from(table){const filters=[];let selection='';const q={select(s){selection=s;privacyCalls.push([table,s]);return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},maybeSingle(){return q;},then(resolve){
 let data;
 if(table==='content_clusters')data=filters.some(([k,v])=>k==='status'&&v!==clusterStatus)?null:{id,status:clusterStatus};
 else if(table==='content_cluster_prompts')data=[{id,kind:'question',prompt:'An editorial idea',display_order:0}];
 else if(table==='content_cluster_items'){
  const tableName=selection.match(/target:(\w+)!inner/)[1];const conf=Object.values(model.targets).find(t=>t.table===tableName);
  data=[{display_order:0,target:{id,title:'Public target'},status:conf.status},{display_order:1,target:{id:privateId,title:'PRIVATE SENTINEL'},status:conf.status==='approved'?'pending':'draft'},{display_order:2,target:{id:privateId,title:'REJECTED SENTINEL'},status:'rejected'}];
  for(const[k,v]of filters)if(k==='target.status')data=data.filter(r=>r.status===v);
 }
 return Promise.resolve({data:fail?null:data,error:fail?{message:'RAW'}:null}).then(resolve);
 }};return q;}};
const dal=load('src/lib/cluster-data.ts',{'@/lib/supabase/server':{createClient:async()=>privacyClient},'@/lib/clusters':model,'@/lib/editorial':editorial});
const publicResult=await dal.clusterContents(id);assert.equal(publicResult.groups.length,6);for(const g of publicResult.groups){assert.equal(g.cards.length,1);assert.equal(g.cards[0].id,id);}assert.doesNotMatch(JSON.stringify(publicResult),/PRIVATE|REJECTED|bbbbbbbb/);
clusterStatus='draft';const hidden=await dal.clusterContents(id);assert.equal(hidden.groups.length,0);assert.equal(hidden.prompts.length,0);
fail=true;assert.equal((await dal.clusterContents(id)).unavailable,true);assert.equal(await dal.publicCluster('seongsu'),null);assert.equal(await dal.publicCluster('../draft'),null);
for(const [,select]of privacyCalls)assert.doesNotMatch(select,/author_id|member_id|profile|meeting|\*/);

const media=load('src/lib/media.ts');const managed=load('src/lib/managed-content.ts',{'@/lib/editorial':editorial,'@/lib/media':media});
const local=load('src/app/admin/local-content/actions.ts',{'@/lib/auth/admin-access':{getAdminAccess:async()=>access},'@/lib/editorial':editorial,'@/lib/managed-content':managed,'next/cache':{revalidatePath(){}}});
const lf=new FormData();for(const[k,v]of Object.entries({name:'Place name',area:'Seoul',category:'Neighborhood',description:'Verified editorial description.',visitor_info:'',status:'draft',image_url:'',image_alt:'',id:'forged',created_at:'forged',role:'admin'}))lf.set(k,v);
access={status:'forbidden'};assert.equal((await local.createManaged('places',lf)).ok,false);access={status:'admin',client};reply={data:{id,updated_at:'2026-09-30T00:00:00Z'},error:null};
for(const kind of ['places','experiences']){calls=[];assert.equal((await local.createManaged(kind,lf)).ok,true);assert.deepEqual(Object.keys(calls.find(c=>c[0]==='insert')[1]).sort(),['area','category','description','image_alt','image_url','name','status','visitor_info']);}assert.equal((await local.createManaged('events',lf)).ok,false);
const sql=read('supabase/migrations/20260929000000_content_clusters.sql');
assert.equal((sql.match(/create table public\./g)||[]).length,3);assert.equal((sql.match(/enable row level security/g)||[]).length,3);assert.match(sql,/num_nonnulls\([^)]*\) = 1/);assert.equal((sql.match(/create unique index content_cluster_items_/g)||[]).length,6);
for(const [key,t]of Object.entries(model.targets)){assert.ok(sql.includes(`${key} uuid references public.${t.table}(id)`));assert.ok(sql.includes(`t.id=${key} and t.status='${t.status}'`));}
assert.match(sql,/c.id=cluster_id and c.status='published'/);assert.match(sql,/p.id=\(select auth.uid\(\)\) and p.role='admin'/);
for(const grant of sql.matchAll(/grant (?:insert|update)\(([^)]+)\)/g))assert.doesNotMatch(grant[1],/published_at|created_at|updated_at|\bid\b/);
assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/security definer|drop |insert into|update public\.|storage\.|grant insert[^;]*on public.events/i);
const manifest=JSON.parse(read('docs/content/sprint-8-manifest.json')),verification=JSON.parse(read('docs/content/sprint-8-verification.json'));
assert.equal(manifest.assets.length,74);assert.equal(new Set(manifest.assets.map(a=>a.id)).size,74);assert.equal(manifest.clusters.length,10);assert.equal(verification.records.length,74);assert.ok(manifest.assets.every(a=>!a.ready_to_publish));assert.equal(manifest.assets.filter(a=>a.origin==='EXISTING').length,16);assert.equal(manifest.assets.filter(a=>a.origin==='EXISTING_DRAFT').length,10);assert.equal(manifest.assets.filter(a=>a.origin==='NEW').length,48);
console.log('PASS: cluster validation, six private target filters under broad visibility, private cluster/prompts fail closed, admin action denials/whitelists/zero rows, local create authorization, SQL RLS/FK/unique/grants, 74-asset manifest. Static/mocks only, no real PostgreSQL execution.');
