// Real independent local PostgreSQL sessions. Synthetic fresh DB only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {buildPackage} from '../scripts/member-deployment/package.mjs';
import {releaseGate} from '../scripts/member-deployment/release-gate.mjs';
import {streamFixture} from './fixtures/member-stream.mjs';
const {default:{Client}}=await import(pathToFileURL(process.env.PG_TEST_MODULE_PATH).href);
const base={host:'127.0.0.1',port:55476,user:'postgres',password:'',connectionTimeoutMillis:3000,query_timeout:15000};
const name='member_release_'+randomBytes(8).toString('hex'),ctl=new Client({...base,database:'postgres'}),connections=[];
const id=n=>`eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12,'0')}`;
const owner=id(1),other=id(2),admin=id(3),sha='a'.repeat(40),config={sha,previousSha:'b'.repeat(40),projectId:'prj_synthetic',domain:'kgroov.com'};
const pkg=buildPackage(resolve('.')),on=fs.readFileSync('scripts/member-deployment/gate-on.sql','utf8'),off=fs.readFileSync('scripts/member-deployment/gate-off.sql','utf8');
let made=false,passed=0,stage='connect';
const check=(v,m)=>{assert.ok(v,m);passed++;};
async function connect(){const c=new Client({...base,database:name});c.on('error',()=>{});await c.connect();connections.push(c);await c.query("set statement_timeout='10s';set lock_timeout='1s'");return c;}
async function as(c,actor,sql,args=[],commit=false){await c.query('begin');try{await c.query(`set local role ${actor===null?'anon':actor==='service'?'service_role':'authenticated'}`);if(actor&&actor!=='service')await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const r=await c.query(sql,args);await c.query(commit?'commit':'rollback');return r;}catch(e){await c.query('rollback');throw e;}}
async function deny(fn,codes=['55000']){await assert.rejects(fn,e=>codes.includes(e.code));passed++;}
const request=async p=>p.startsWith('/v4/')?{projectId:config.projectId,deployment:{id:'dpl_synthetic'}}:{id:'dpl_synthetic',projectId:config.projectId,target:'production',readyState:'READY',meta:{githubCommitSha:sha}};
const app=async url=>new URL(url).pathname.startsWith('/admin/')?new Response(null,{status:307,headers:{location:'/login'}}):new Response('KGROOV');
try{
 await ctl.connect();check(/\/kgroov-member-db-[0-9a-f]+\/data$/.test((await ctl.query('show data_directory')).rows[0].data_directory.replaceAll('\\','/')),'isolated directory');
 await ctl.query(`create database ${name}`);made=true;const a=await connect(),b=await connect();
 const boot=fs.readFileSync('tests/selective-publication-db-security.mjs','utf8').match(/await root\.query\(`(create schema auth;create schema storage;[\s\S]*?)`\);/);check(boot&&!boot[1].includes('${'),'known synthetic bootstrap');await a.query(boot[1]);
 for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f<'20261018000000').sort())await a.query(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 await a.query('insert into auth.users values($1),($2),($3)',[owner,other,admin]);await a.query("update profiles set role='admin' where id=$1",[admin]);
 await a.query("insert into places(id,name,area,category,description,status) values($1,'Synthetic place','Seoul','culture','Synthetic description','published')",[id(4)]);
 await a.query("insert into questions(id,author_id,title,body,status,published_at) values($1,$2,'Synthetic parent','Synthetic parent question body','approved',now()),($3,$2,'Synthetic target','Synthetic target question body','pending',null)",[id(5),owner,id(6)]);
 await a.query("insert into community_posts(id,author_id,type,title,body,status,published_at) values($1,$2,'story','Synthetic parent','Synthetic parent story body','approved',now()),($3,$2,'story','Synthetic target','Synthetic target story body','pending',null)",[id(7),owner,id(8)]);
 await a.query("insert into community_posts(id,author_id,type,body,youtube_video_id,youtube_title,youtube_channel_name) values($1,$2,'moment','Synthetic video caption','abcdefghijk','Synthetic video','Synthetic channel')",[id(9),owner]);
 await a.query("insert into answers(id,author_id,question_id,body) values($1,$2,$3,'Synthetic answer body')",[id(10),owner,id(5)]);
 await a.query("insert into reviews(id,author_id,place_id,body) values($1,$2,$3,'Synthetic review body')",[id(11),owner,id(4)]);
 await a.query("insert into community_comments(id,author_id,post_id,body) values($1,$2,$3,'Synthetic comment body')",[id(12),owner,id(7)]);
 await a.query("insert into community_uploads(id,owner_id) values($1,$2)",[id(90),owner]);
 await a.query("insert into storage.objects(bucket_id,name) values('community-media',$1),('site-media','synthetic')",[id(90)+'/image.webp']);
 stage='freeze_old';await a.query(on);
 for(const type of ['story','tip','discussion','moment'])await deny(()=>as(b,admin,'insert into community_posts(author_id,type,body) values($1,$2,$3)',[admin,type,'Synthetic insertion body']));
 for(const [table,cols,values] of [['questions','author_id,title,body',[owner,'Synthetic title','Synthetic body']],['answers','author_id,question_id,body',[owner,id(5),'Synthetic body']],['reviews','author_id,place_id,body',[owner,id(4),'Synthetic body']],['community_comments','post_id,body',[id(7),'Synthetic body']],['community_uploads','owner_id',[owner]],['community_helpful','post_id',[id(7)]],['community_reports','post_id,reason',[id(7),'spam']]])await deny(()=>as(b,owner,`insert into ${table}(${cols}) values(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values));
 check((await as(b,null,'select body from community_posts where id=$1',[id(7)])).rowCount===1,'public read while frozen');
 check((await as(b,owner,'select id from profiles where id=$1',[owner])).rowCount===1,'own profile read while frozen');
 check((await a.query('select count(*) n from auth.users')).rows[0].n==='3','Auth table not blocked');
 await a.query("begin;select set_config('storage.operation','object.get_authenticated',true)");await a.query('set local role authenticated');await a.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);check((await a.query("select name from storage.objects where bucket_id='community-media'")).rowCount===1,'normal SQL image read');await a.query('rollback');
 await deny(()=>a.query("insert into storage.objects(bucket_id,name) values('community-media','synthetic-denied')"));
 await a.query("begin;insert into storage.objects(bucket_id,name) values('site-media','synthetic-allowed');rollback");passed++;
 stage='atomic_rollback';await a.query('begin');await a.query(pkg.sql);check((await b.query("select to_regnamespace('member_content_private') is null invisible")).rows[0].invisible,'uncommitted A+B invisible');
 await deny(()=>a.query('select 1/0'),['22012']);await a.query('rollback');check((await b.query("select to_regnamespace('member_content_private') is null absent")).rows[0].absent,'A+B rolled back');check((await b.query("select to_regclass('supabase_migrations.schema_migrations') is null absent")).rows[0].absent,'history rolled back');await a.query('select member_deployment.assert_guards(false)');passed++;
 stage='lock_timeout';await b.query('begin;lock table community_posts in access share mode');await a.query("begin;set local lock_timeout='100ms'");await deny(()=>a.query('alter table community_posts add column synthetic_timeout boolean'),['55P03']);await a.query('rollback');await b.query('rollback');
 stage='atomic_success';await a.query('begin');await a.query(pkg.sql);await a.query('commit');await a.query('select member_deployment.assert_guards(true)');passed++;
 check((await a.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows.every((r,i)=>r.version===pkg.entries[i].version&&r.name===pkg.entries[i].name&&r.statements[0]===pkg.entries[i].body),'exact migration history');
 const tables=(await a.query('select unnest(member_deployment.targets(true)) t')).rows;
 for(const {t} of tables){await deny(()=>a.query(`delete from ${t} where false`));await deny(()=>a.query(`truncate ${t}`),['55000','0A000']);}
 stage='rpc_freeze';
 for(const [kind,target] of [['post',id(8)],['question',id(6)],['answer',id(10)],['review',id(11)],['comment',id(12)]]){
  for(const op of ['edit','delete'])await deny(()=>as(b,owner,'select manage_member_content($1,$2,1,$3,$4)',[kind,target,op,op==='edit'?{body:'Synthetic edited content'}:{}]));
  await deny(()=>as(b,admin,"select manage_member_content($1,$2,1,'reject')",[kind,target]));
  for(const action of ['warn','restrict','suspend','hide'])await deny(()=>as(b,admin,'select review_member_policy($1,$2,1,$3,$4)',[kind,target,action,'spam']),['55000','42501']);
 }
 await deny(()=>as(b,admin,"select manage_member_content('post',$1,1,'feature')",[id(7)]));
 await deny(()=>as(b,other,"select report_member_content('post',$1,'spam')",[id(7)]));
 await deny(()=>as(b,'service',"select register_verified_member_video('lmnopqrstuv','Synthetic video','Synthetic channel')"));
 // Normal roles cannot remove guards or forge the deployment attestation.
 for(const actor of [null,owner,other,admin,'service'])await deny(()=>as(b,actor,"update member_deployment.gate set verified_sha=repeat('a',40)"),['42501']);
 stage='release_negative';await deny(()=>a.query(off),['55000']);await a.query('rollback');
 await a.query('update member_deployment.gate set candidate_sha=$1',[sha]);
 await assert.rejects(()=>releaseGate(a,request,config,resolve('.'),async()=>new Response('failure',{status:500})));passed++;
 for(const bad of [r=>({...r,readyState:'BUILDING'}),r=>({...r,target:'preview'}),r=>({...r,projectId:'prj_wrong'}),r=>({...r,meta:{githubCommitSha:'b'.repeat(40)}})]){await assert.rejects(()=>releaseGate(a,async p=>p.startsWith('/v4/')?request(p):bad(await request(p)),config,resolve('.'),app));passed++;}
 await a.query('begin');await a.query("update supabase_migrations.schema_migrations set name='wrong' where version=$1",[pkg.entries[0].version]);await a.query('commit');await assert.rejects(()=>releaseGate(a,request,config,resolve('.'),app));passed++;await a.query('update supabase_migrations.schema_migrations set name=$1 where version=$2',[pkg.entries[0].name,pkg.entries[0].version]);
 await a.query('select member_deployment.assert_guards(true)');passed++;
 await assert.rejects(()=>releaseGate(a,request,{...config,previousSha:sha},resolve('.'),app));passed++;
 let switched=false;await assert.rejects(()=>releaseGate(a,async p=>{
  if(!switched){switched=true;await b.query('update member_deployment.gate set activation=gen_random_uuid()');}
  return request(p);
 },config,resolve('.'),app));passed++;
 await a.query("update member_deployment.gate set verified_sha=candidate_sha,verified_deployment='dpl_synthetic',verified_at=now()-interval '3 minutes'");
 await deny(()=>a.query(off),['55000']);await a.query('rollback');
 await a.query('update member_deployment.gate set verified_sha=null,verified_deployment=null,verified_at=null');
 stage='stream_release_negative';
 for(const transform of [h=>h.replace('</main>','<p>Private queue</p></main>'),h=>h.replace('1;url=/login','1;url=https://evil.invalid/login')]) {
  await assert.rejects(()=>releaseGate(a,request,config,resolve('.'),async url=>new URL(url).pathname.startsWith('/admin/')?new Response(transform(streamFixture(new URL(url).pathname)),{headers:{'content-type':'text/html'}}):new Response('KGROOV')),e=>e.message==='APPLICATION_VERIFICATION_FAILED_GATE_REMAINS');passed++;
  check((await a.query('select verified_sha is null and storage_frozen frozen from member_deployment.gate where singleton')).rows[0].frozen,'invalid stream cannot attest/unfreeze');
  await a.query('select member_deployment.assert_guards(true)');passed++;
 }
 stage='release_positive';await releaseGate(a,request,config,resolve('.'),async url=>new URL(url).pathname.startsWith('/admin/')?new Response(streamFixture(new URL(url).pathname),{headers:{'content-type':'text/html'}}):new Response('KGROOV'));
 check((await a.query("select count(*) n from pg_trigger where tgname='a_member_deployment_freeze'")).rows[0].n==='0','verified release removed app guards');
 check((await a.query('select not storage_frozen released from member_deployment.gate where singleton')).rows[0].released,'permanent Storage guard dormant after verified release');
 await a.query("begin;insert into storage.objects(bucket_id,name) values('community-media','released-synthetic');rollback");passed++;
 const edited=(await as(b,owner,"select manage_member_content('post',$1,1,'edit',$2) r",[id(9),{body:'Synthetic YouTube-only edit',commercial_disclosure:'personal'}],true)).rows[0].r;check(edited.changed===true,'YouTube-only edit after release');
 const deleted=(await as(b,owner,"select manage_member_content('post',$1,2,'delete') r",[id(9)],true)).rows[0].r;check(deleted.status==='deleted'&&!deleted.cleanup_pending,'YouTube-only delete after release');
 for(const who of [null,owner,other,admin])check((await as(b,who,'select body from community_posts where id=$1',[id(9)])).rowCount===0,'deleted content private');
 check((await as(b,admin,"update questions set status='approved' where id=$1 returning id",[id(6)])).rowCount===0,'old direct admin UPDATE remains denied after release');
 stage='refreeze';
 await b.query('begin isolation level repeatable read');
 await b.query('select count(*) from auth.users'); // Establish snapshot without holding gate DDL locks.
 await a.query(on);await a.query('select member_deployment.assert_guards(true)');passed++;
 await deny(()=>b.query("insert into storage.objects(bucket_id,name) values('community-media','stale-snapshot-write')"),['40001']);
 await b.query('rollback');
 check((await a.query('select candidate_sha is null and verified_sha is null cleared from member_deployment.gate')).rows[0].cleared,'reactivation invalidates verification');
 await deny(()=>as(b,admin,"select manage_member_content('post',$1,3,'approve')",[id(9)]),['PT409','42501']);
 console.log(JSON.stringify({result:'PASS',assertions:passed,scope:'synthetic PostgreSQL freeze/atomic/release; Vercel responses mocked; Storage SQL only, not HTTP'}));
}catch(e){console.log(JSON.stringify({result:'FAIL',stage,sqlstate:/^[A-Z0-9]{5}$/.test(e?.code??'')?e.code:'ASSERTION',passed}));process.exitCode=1;}
finally{for(const c of connections){await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});}if(made)await ctl.query(`drop database ${name}`).catch(()=>{process.exitCode=1;});await ctl.end().catch(()=>{});}
