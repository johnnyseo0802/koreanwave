// Historical owner-management baseline. Final policy is additionally tested in selective-publication-db-security.mjs.
// Synthetic-only real PostgreSQL test. Fixed loopback endpoint, fresh database.
// No env files, hosted URLs, production credentials, or existing DB contents.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const { default: { Client } } = await import(pathToFileURL(process.env.PG_TEST_MODULE_PATH).href);
const database = `member_content_${randomBytes(8).toString('hex')}`;
const base = { host:'127.0.0.1', port:55476, user:'postgres', password:'', connectionTimeoutMillis:3000, query_timeout:12000 };
const ctl=new Client({...base,database:'postgres'}), clients=[];
const id=n=>`cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12,'0')}`;
const owner=id(1),other=id(2),admin=id(3);
let created=false,passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++;};
const table={post:'community_posts',question:'questions',answer:'answers',review:'reviews',comment:'community_comments'};
async function connection(){const c=new Client({...base,database});await c.connect();clients.push(c);await c.query("set statement_timeout='8s';set lock_timeout='4s'");return c;}
async function as(c,who,fn){await c.query('begin');await c.query(`set local role ${who?'authenticated':'anon'}`);if(who)await c.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);try{const r=await fn();await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}}
const mutation=(c,kind,target,revision,operation,patch={})=>c.query('select public.manage_member_content($1,$2,$3,$4,$5) result',[kind,target,revision,operation,patch]);
async function deny(fn,codes=['42501','PT409']){await assert.rejects(fn,e=>codes.includes(e.code));passed++;}
try{
 await ctl.connect();
 const location=(await ctl.query('show data_directory')).rows[0].data_directory.replaceAll('\\','/');
 assert.match(location,/\/kgroov-member-db-[0-9a-f]+\/data$/);
 for(const role of ['anon','authenticated','service_role']){
  if(!(await ctl.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await ctl.query(`create role ${role}${role==='service_role'?' bypassrls':''}`);
 }
 await ctl.query(`create database ${database}`);created=true;
 const root=await connection(),a=await connection(),b=await connection();
 await root.query(`create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;
 create function storage.allow_any_operation(expected text[]) returns boolean language sql stable as $$select exists(select 1 from unnest(expected) e where replace(current_setting('storage.operation',true),'storage.','')=replace(e,'storage.',''))$$;`);
 for(const name of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql') && n<'20261018010000').sort()){
  try{await root.query(fs.readFileSync(`supabase/migrations/${name}`,'utf8'));}
  catch(e){console.error('Migration failed:',name,'SQLSTATE',e.code);throw e;}
 }
 await root.query('insert into auth.users values($1),($2),($3)',[owner,other,admin]);
 await root.query("update profiles set role='admin' where id=$1",[admin]);
 await root.query("insert into places(id,name,area,category,description,status) values($1,'Synthetic place','Seoul','culture','Synthetic place description','published')",[id(4)]);
 await root.query("insert into questions(id,author_id,title,body,status,published_at) values($1,$2,'Synthetic question','Synthetic question body','approved',now())",[id(5),owner]);
 await root.query("insert into community_posts(id,author_id,type,title,body,status,published_at) values($1,$2,'story','Parent fixture','Synthetic parent story body','approved',now())",[id(6),owner]);
 let seq=100;
 async function fixture(kind,state='pending',type='story'){
  const target=id(++seq);
  if(kind==='post'){
   if(type==='moment')await root.query("insert into community_posts(id,author_id,type,body,youtube_video_id,youtube_title,youtube_channel_name,status,published_at) values($1,$2,'moment','Synthetic video caption','abcdefghijk','Synthetic video','Synthetic channel',$3,case when $3='approved' then now() end)",[target,owner,state]);
   else await root.query("insert into community_posts(id,author_id,type,title,body,topic,status,published_at) values($1,$2,$3,'Synthetic title','Synthetic original body long enough','other',$4,case when $4='approved' then now() end)",[target,owner,type,state]);
  }else if(kind==='question')await root.query("insert into questions(id,author_id,title,body,status,published_at) values($1,$2,'Synthetic title','Synthetic original body long enough',$3,case when $3='approved' then now() end)",[target,owner,state]);
  else if(kind==='answer')await root.query("insert into answers(id,author_id,question_id,body,status,published_at) values($1,$2,$3,'Synthetic original body long enough',$4,case when $4='approved' then now() end)",[target,owner,id(5),state]);
  else if(kind==='review')await root.query("insert into reviews(id,author_id,place_id,body,status,published_at) values($1,$2,$3,'Synthetic original body long enough',$4,case when $4='approved' then now() end)",[target,owner,id(4),state]);
  else {await root.query("insert into community_comments(id,author_id,post_id,body,created_at) values($1,$2,$3,'Synthetic original body long enough',now()-interval '1 hour')",[target,owner,id(6)]);
   // INSERT owns its timestamp. Space synthetic fixtures outside rate-limit window.
  }
  return target;
 }
 for(const [kind,type] of [['post','story'],['post','tip'],['post','moment'],['post','discussion'],['question'],['answer'],['review'],['comment']]){
  const target=await fixture(kind,'approved',type);
  const original=(await root.query(`select created_at,published_at from ${table[kind]} where id=$1`,[target])).rows[0];
  await deny(()=>as(a,null,()=>mutation(a,kind,target,1,'edit',{body:'Synthetic changed body long enough'})));
  await deny(()=>as(a,other,()=>mutation(a,kind,target,1,'delete')));
  await deny(()=>as(a,admin,()=>mutation(a,kind,target,1,'edit',{body:'Synthetic changed body long enough'})));
  for(const patch of [{author_id:other},{status:'approved'},{edited_at:'2026-01-01'},{published_at:'2026-01-01'},{revision:'20'}])await deny(()=>as(a,owner,()=>mutation(a,kind,target,1,'edit',patch)));
  const unchanged=await as(a,owner,()=>mutation(a,kind,target,1,'edit',{body:kind==='post'&&type==='moment'?'Synthetic video caption':'Synthetic original body long enough'}));
  check(unchanged.rows[0].result.changed===false,'No-op save');
  await as(a,owner,()=>mutation(a,kind,target,1,'edit',{body:'Synthetic changed body long enough'}));
  const state=(await root.query(`select edited_at,revision,status,created_at,published_at from ${table[kind]} where id=$1`,[target])).rows[0];
  check(state.edited_at&&state.revision==='2','Server edit stamp and revision');
  check(state.status===(kind==='comment'?'approved':'pending'),'Re-review policy');
  assert.deepEqual(state.created_at,original.created_at);assert.deepEqual(state.published_at,original.published_at);passed+=2;
  await deny(()=>as(a,owner,()=>mutation(a,kind,target,1,'edit',{body:'Stale revision overwrite'})));
  const direct=await as(a,admin,()=>a.query(`update ${table[kind]} set status='approved' where id=$1 returning id`,[target]));check(direct.rowCount===0,'Direct moderator bypass denied');
  if(kind!=='comment'){
   await as(a,admin,()=>mutation(a,kind,target,2,'approve'));
   const approved=(await root.query(`select edited_at,published_at from ${table[kind]} where id=$1`,[target])).rows[0];
   assert.deepEqual(approved.edited_at,state.edited_at);assert.deepEqual(approved.published_at,original.published_at);passed+=2;
  }
  const revision=kind==='comment'?2:3;
  await as(a,owner,()=>mutation(a,kind,target,revision,'delete'));
  await as(a,owner,()=>mutation(a,kind,target,revision,'delete'));passed++;
  for(const who of [null,owner,other,admin])check((await as(a,who,()=>a.query(`select id,body from ${table[kind]} where id=$1`,[target]))).rowCount===0,'Deleted original must not be visible');
  await deny(()=>as(a,admin,()=>mutation(a,kind,target,revision+1,'approve')));
  const owned=await as(a,owner,()=>a.query('select * from my_manageable_content()'));
  check(!owned.rows.some(r=>r.my_manageable_content.id===target),'Deleted own projection');
 }
 // Pending/rejected state matrix; hidden content cannot self-republish.
 for(const kind of ['post','question','answer','review'])for(const status of ['pending','rejected']){
  const target=await fixture(kind,status);
  if(status==='rejected')await deny(()=>as(a,owner,()=>mutation(a,kind,target,1,'edit',{body:'A rejected edit must stay rejected'})));
  else{await as(a,owner,()=>mutation(a,kind,target,1,'edit',{body:'A pending edit stays private too'}));check((await root.query(`select status from ${table[kind]} where id=$1`,[target])).rows[0].status==='pending','Pending remains pending');}
  await as(a,owner,()=>mutation(a,kind,target,status==='pending'?2:1,'delete'));passed++;
 }
 // Direct media forgery cannot bypass the server verification record.
 const video=await fixture('post','approved','moment');
 await deny(()=>as(a,owner,()=>mutation(a,'post',video,1,'edit',{youtube_video_id:'lmnopqrstuv',youtube_title:'Forged',youtube_channel_name:'Forged'})));
 await deny(()=>as(a,admin,()=>a.query("select register_verified_member_video('lmnopqrstuv','Verified title','Verified channel')")));
 await root.query("select register_verified_member_video('lmnopqrstuv','Verified title','Verified channel')");
 await as(a,owner,()=>mutation(a,'post',video,1,'edit',{youtube_video_id:'lmnopqrstuv',youtube_title:'Verified title',youtube_channel_name:'Verified channel'}));passed++;
 // No-image YouTube deletion needs no Storage queue/cleanup credential.
 const videoDelete=await as(a,owner,()=>mutation(a,'post',video,2,'delete'));check(videoDelete.rows[0].result.cleanup_pending===false,'No-image deletion completed without fake cleanup failure');
 // Original safe upload registry INSERT RETURNING, and image retirement.
 const upload=await as(a,owner,()=>a.query('insert into community_uploads(owner_id) values($1) returning id',[owner]));check(upload.rowCount===1,'Upload INSERT RETURNING');
 const image=upload.rows[0].id;
 await root.query("insert into storage.objects(bucket_id,name) values('community-media',$1)",[image+'/image.webp']);
 const photo=id(++seq);
 await root.query("insert into community_posts(id,author_id,type,body,image_id,status,published_at) values($1,$2,'moment','Synthetic photo caption',$3,'approved',now())",[photo,owner,image]);
 for(const who of [null,owner,other,admin]){
  check((await as(a,who,()=>a.query('select community_media_allowed($1) ok',[image+'/image.webp']))).rows[0].ok,'Approved image access');
  await as(a,who,async()=>{await a.query("select set_config('storage.operation','object.sign',true)");check((await a.query("select id from storage.objects where bucket_id='community-media' and name=$1",[image+'/image.webp'])).rowCount===0,'Signing operation denied');});
 }
 const receipt=await as(a,owner,()=>mutation(a,'post',photo,1,'delete'));check(receipt.rows[0].result.cleanup_pending===true,'Durable pending image cleanup');
 for(const who of [null,owner,other,admin])check(!(await as(a,who,()=>a.query('select community_media_allowed($1) ok',[image+'/image.webp']))).rows[0].ok,'Deleted image denied before physical removal');
 await deny(()=>as(a,owner,()=>a.query('select * from member_media_cleanup($1)',[photo])));
 check((await as(a,admin,()=>a.query('select * from member_cleanup_pending()'))).rowCount===1,'Manual retry queue');
 check((await root.query('select * from member_media_cleanup($1)',[photo])).rowCount===1,'Failure leaves pending receipt');
 await root.query('select * from member_media_cleanup($1,$2)',[photo,image]);
 check((await as(a,admin,()=>a.query('select * from member_cleanup_pending()'))).rowCount===0,'Acknowledged cleanup leaves queue');
 const oldPhoto=id(++seq),replacement=id(++seq),alien=id(++seq),photoPost=id(++seq);
 await root.query('insert into community_uploads(id,owner_id) values($1,$4),($2,$4),($3,$5)',[oldPhoto,replacement,alien,owner,other]);
 for(const media of [oldPhoto,replacement,alien])await root.query("insert into storage.objects(bucket_id,name) values('community-media',$1)",[media+'/image.webp']);
 await root.query("insert into community_posts(id,author_id,type,body,image_id,status,published_at) values($1,$2,'moment','Photo to replace',$3,'approved',now())",[photoPost,owner,oldPhoto]);
 await deny(()=>as(a,owner,()=>mutation(a,'post',photoPost,1,'edit',{image_id:alien})));
 await as(a,owner,()=>mutation(a,'post',photoPost,1,'edit',{image_id:replacement}));
 check((await root.query('select status,edited_at from community_posts where id=$1',[photoPost])).rows[0].status==='pending','Photo replacement requires reapproval');
 for(const who of [null,owner,other,admin])check(!(await as(a,who,()=>a.query('select community_media_allowed($1) ok',[oldPhoto+'/image.webp']))).rows[0].ok,'Replaced photo no longer readable');
 check((await as(a,owner,()=>a.query('select community_media_allowed($1) ok',[replacement+'/image.webp']))).rows[0].ok,'Owner can preview replacement');
 check(!(await as(a,other,()=>a.query('select community_media_allowed($1) ok',[replacement+'/image.webp']))).rows[0].ok,'Other member cannot read pending replacement');
 await deny(()=>as(a,owner,()=>mutation(a,'post',photoPost,2,'edit',{image_id:oldPhoto})));
 // Descendants and reports disappear even for their own authors and app admins.
 const parent=id(++seq),reply=id(++seq),q=await fixture('question','approved'),answer=id(++seq);
 await root.query("insert into community_comments(id,post_id,author_id,body) values($1,$2,$3,'Synthetic root comment')",[parent,id(6),other]);
 await root.query("insert into community_comments(id,post_id,parent_comment_id,author_id,body) values($1,$2,$3,$4,'Synthetic reply comment')",[reply,id(6),parent,owner]);
 await root.query("insert into community_reports(post_id,comment_id,reporter_id,reason,details) values($1,$2,$3,'spam','Synthetic restricted report')",[id(6),reply,other]);
 await root.query("insert into answers(id,author_id,question_id,body,status,published_at) values($1,$2,$3,'Synthetic descendant answer','approved',now())",[answer,other,q]);
 await as(a,other,()=>mutation(a,'comment',parent,1,'delete'));
 await as(a,owner,()=>mutation(a,'question',q,1,'delete'));
 for(const who of [null,owner,other,admin]){
  check((await as(a,who,()=>a.query('select id,body from community_comments where id=$1',[reply]))).rowCount===0,'Deleted-root reply hidden');
  check((await as(a,who,()=>a.query('select id,body from answers where id=$1',[answer]))).rowCount===0,'Deleted-question answer hidden');
 }
 check((await as(a,admin,()=>a.query('select details from community_reports where comment_id=$1',[reply]))).rowCount===0,'Report indirect content hidden');
 check((await as(a,owner,()=>a.query('select * from my_conversation_comments($1)',[id(6)]))).rows.every(r=>r.id!==reply),'Own comment helper does not bypass ancestor deletion');
 // Existing aggregate/translation/cluster paths must not reveal a deleted root.
 const linked=await fixture('post','approved','discussion'),cluster=id(++seq);
 await root.query("insert into content_clusters(id,slug,title,summary,introduction,status) values($1,'synthetic-management','Synthetic cluster','Synthetic cluster summary','Synthetic cluster introduction body','published')",[cluster]);
 await root.query('insert into content_cluster_items(cluster_id,community_post_id) values($1,$2)',[cluster,linked]);
 await as(a,other,()=>a.query("insert into community_helpful(post_id,reaction_type) values($1,'like')",[linked]));
 await root.query("insert into conversation_translations(content_type,content_id,source_language,target_language,source_hash,translated_text,provider,model) values('post',$1,'en','ko',repeat('a',64),'Synthetic cached translation','synthetic','synthetic')",[linked]);
 check((await as(a,null,()=>a.query('select community_post_id from content_cluster_items where cluster_id=$1',[cluster]))).rowCount===1,'Published cluster fixture visible before deletion');
 check((await as(a,null,()=>a.query('select * from conversation_reaction_counts($1)',[linked]))).rowCount===1,'Reaction fixture visible before deletion');
 await as(a,owner,()=>mutation(a,'post',linked,1,'delete'));
 for(const who of [null,owner,other,admin]){
  check((await as(a,who,()=>a.query("select body from community_posts where id=$1 and status='approved' and type in ('discussion','moment','story','tip')",[linked]))).rowCount===0,'Authoritative translation source lookup denied after deletion');
  await deny(()=>as(a,who,()=>a.query('select translated_text from conversation_translations where content_id=$1',[linked])));
  check((await as(a,who,()=>a.query('select community_post_id from content_cluster_items where cluster_id=$1',[cluster]))).rowCount===0,'Cluster link hidden including ordinary admin');
  check((await as(a,who,()=>a.query('select * from conversation_reaction_counts($1)',[linked]))).rowCount===0,'Reaction aggregate hidden');
  check((await as(a,who,()=>a.query('select * from conversation_activity($1)',[[linked]]))).rowCount===0,'Homepage activity hidden');
 }
 check((await as(a,other,()=>a.query('select post_id from community_helpful where post_id=$1',[linked]))).rowCount===0,'Own reaction cannot expose deleted root');
 for(const kind of Object.keys(table))await deny(()=>as(a,owner,()=>a.query(`select author_id from ${table[kind]}`)));
 // Real backend lock wait: stale edit/approve/delete must never win after waiting.
 for(const second of ['edit','approve','delete']){
  const target=await fixture('post');
  await a.query('begin;set local role authenticated');await a.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
  await mutation(a,'post',target,1,'edit',{body:'Synthetic winning edit body'});
  const pending=as(b,second==='approve'?admin:owner,()=>mutation(b,'post',target,1,second,second==='edit'?{body:'Synthetic stale edit body'}:{})).then(()=>({ok:true}),e=>({code:e.code}));
  let blocked=false;
  for(let i=0;i<100;i++){if((await root.query('select cardinality(pg_blocking_pids($1))>0 blocked',[b.processID])).rows[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
  check(blocked,'Independent backend lock wait observed');await a.query('commit');check((await pending).code==='PT409','Stale waiter refused');
  check((await root.query('select status,revision from community_posts where id=$1',[target])).rows[0].status==='pending','Unreviewed edit stays private');
 }
 for(const kind of ['question','answer','review','comment']){
  const target=await fixture(kind,'approved');
  await a.query('begin;set local role authenticated');await a.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
  await mutation(a,kind,target,1,'edit',{body:'Synthetic concurrent owner edit'});
  const pending=as(b,owner,()=>mutation(b,kind,target,1,'edit',{body:'Synthetic stale owner edit'})).then(()=>({ok:true}),e=>({code:e.code}));
  let blocked=false;for(let i=0;i<100;i++){if((await root.query('select cardinality(pg_blocking_pids($1))>0 blocked',[b.processID])).rows[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
  check(blocked,'Other type independent lock wait');await a.query('commit');check((await pending).code==='PT409','Other type stale edit denied');
 }
 console.log(JSON.stringify({result:'PASS',assertions:passed,scope:'fresh synthetic PostgreSQL; no hosted Storage HTTP'}));
}catch(e){console.error(JSON.stringify({result:'FAIL',assertions:passed,code:e.code??'ASSERTION',message:e.code?'Database assertion failed':e.message}));process.exitCode=1;}
finally{for(const c of clients)await c.end();if(created)await ctl.query(`drop database ${database}`);await ctl.end();}
