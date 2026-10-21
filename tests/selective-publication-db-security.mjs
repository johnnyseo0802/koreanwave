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

 // Preserve exact legacy statuses before applying the new draft.
 const legacy=await fixture('post','pending'),hidden=await fixture('question','rejected');
 await root.query(fs.readFileSync('supabase/migrations/20261018010000_selective_community_publication.sql','utf8'));
 check((await root.query('select status from community_posts where id=$1',[legacy])).rows[0].status==='pending','No legacy pending publication');
 check((await root.query('select status from questions where id=$1',[hidden])).rows[0].status==='rejected','No hidden publication');
 const read=async(kind,target)=>(await root.query(`select * from ${table[kind]} where id=$1`,[target])).rows[0];
 async function clearRestriction(){
  const row=(await as(a,admin,()=>a.query("select * from member_policy_queue('restrictions')"))).rows[0].member_policy_queue;
  await as(a,admin,()=>a.query('select clear_member_writing_restriction($1,$2)',[row.id,row.revision]));
 }
 async function submit(kind,disclosure='personal',body='My personal experience was interesting.',type='story',actor=owner){
  body+=' Synthetic context.';
  let result;
  if(kind==='post'){
   const fields=type==='moment'?{type,body,youtube_video_id:'abcdefghijk',youtube_title:'Synthetic video',youtube_channel_name:'Synthetic channel'}:{type,title:'Synthetic ordinary title',body,topic:'other'};
   const keys=Object.keys(fields);result=await as(a,actor,()=>a.query(`insert into community_posts(author_id,commercial_disclosure,${keys.join(',')}) values($1,$2,${keys.map((_,i)=>'$'+(i+3)).join(',')}) returning id`,[actor,disclosure,...Object.values(fields)]));
  }else{
   const values=kind==='question'?{title:'Synthetic ordinary question',body}:kind==='answer'?{question_id:id(5),body}:kind==='review'?{place_id:id(4),body}:{post_id:id(6),body};
   const row={...(kind==='comment'?{}:{author_id:actor}),commercial_disclosure:disclosure,...values};
   const keys=Object.keys(row);result=await as(a,actor,()=>a.query(`insert into ${table[kind]}(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning id`,Object.values(row)));
  }
  return result.rows[0].id;
 }
 for(const kind of Object.keys(table)){
  const target=await submit(kind);let row=await read(kind,target);
  check(row.status==='approved'&&row.edited_at===null&&row.published_at,'Personal immediate publication');
  const date=row.published_at.toISOString();
  await deny(()=>as(a,other,()=>mutation(a,kind,target,1,'edit',{body:'Hijacked content'})));
  await deny(()=>as(a,null,()=>mutation(a,kind,target,1,'delete')));
  await as(a,owner,()=>mutation(a,kind,target,1,'edit',{body:row.body,commercial_disclosure:'personal'}));
  check((await read(kind,target)).edited_at===null,'No-op has no Edited');
  await as(a,owner,()=>mutation(a,kind,target,1,'edit',{body:'A real personal edit with a product price $20.',commercial_disclosure:'personal'}));
  row=await read(kind,target);check(row.status==='approved'&&row.edited_at&&row.published_at.toISOString()===date,'Personal edit stays public; first date kept');
  await as(a,owner,()=>mutation(a,kind,target,2,'edit',{body:'Use my referral code: SAVE',commercial_disclosure:'personal'}));
  row=await read(kind,target);check(row.status==='pending'&&row.review_reason==='commercial_signal','Disguised promotion held in DB');
  check((await as(a,null,()=>a.query(`select body from ${table[kind]} where id=$1`,[target]))).rowCount===0,'Pending private');
  await as(a,owner,()=>mutation(a,kind,target,3,'edit',{body:'Now claiming to be personal.',commercial_disclosure:'personal'}));
  check((await read(kind,target)).status==='pending','Commercial hold cannot be cleared by author');
  await as(a,admin,()=>mutation(a,kind,target,4,'approve'));
  const edited=(await read(kind,target)).edited_at.toISOString();
  await as(a,admin,()=>mutation(a,kind,target,5,'reject'));
  check((await read(kind,target)).edited_at.toISOString()===edited,'Hide is not owner edit');
  await deny(()=>as(a,owner,()=>mutation(a,kind,target,6,'edit',{body:'Republish hidden content'})));
  await as(a,admin,()=>a.query("select review_member_policy($1,$2,6,'restore','false_positive')",[kind,target]));
  check((await read(kind,target)).status==='approved','Explicit admin restore');
  await as(a,owner,()=>mutation(a,kind,target,7,'delete'));
  for(const who of [null,owner,other,admin])check((await as(a,who,()=>a.query(`select body from ${table[kind]} where id=$1`,[target]))).rowCount===0,'Deleted hidden for all normal roles');
  await deny(()=>as(a,admin,()=>a.query("select review_member_policy($1,$2,8,'restore','false_positive')",[kind,target])));
  const paid=await submit(kind,'commercial');check((await read(kind,paid)).status==='pending','Explicit disclosure held');
 }
 for(const body of ['I bought skincare for $20.','A useful YouTube video https://youtu.be/abcdefghijk','My personal recommendation is this cafe.','가격은 2만원이었고 좋았어요.','この商品は2000円でした。']){
  check((await read('post',await submit('post','personal',body))).status==='approved','Neutral product/price/link not auto commercial');
 }
 for(const body of ['Paid tour: book now!','유료 클래스 참가자 모집','有料ツアー 予約','https://example.invalid/?affiliate=abc','Use my promo code: SAVE','Use my re​ferral code: SAVE']){
  check((await read('post',await submit('post','personal',body))).status==='pending','Clear solicitation held');
 }
 await deny(()=>submit('post','personal','Buy stolen passwords from me.'),['23514']);
 for(let i=0;i<3;i++){const target=await submit('post','personal','Join our event https://example.invalid/demo');check((await read('post',target)).status===(i===2?'pending':'approved'),'Serialized repeated solicitation');}
 check((await read('post',await submit('post','unspecified'))).status==='pending','Old client omission fails closed');
 await as(a,owner,()=>mutation(a,'post',legacy,1,'edit',{body:'Ordinary legacy pending edit',commercial_disclosure:'personal'}));check((await read('post',legacy)).status==='pending','Legacy hold survives edit');
 await deny(()=>as(a,owner,()=>a.query("select * from member_policy_queue('reports')")));
 const sanction=await submit('post');
 await as(a,other,()=>a.query("select report_member_content('post',$1,'commercial')",[sanction]));
 check((await read('post',sanction)).status==='approved','Report does not automatically hide');
 for(const action of ['warn','restrict','suspend','clear']){
  await deny(()=>as(a,other,()=>a.query('select review_member_policy($1,$2,1,$3,$4)',['post',sanction,action,'spam'])));
 }
 await as(a,admin,()=>a.query("select review_member_policy('post',$1,1,'restrict','spam')",[sanction]));
 await deny(()=>submit('question'));
 await deny(()=>as(a,owner,()=>mutation(a,'post',sanction,1,'edit',{body:'Cannot edit while restricted'})));
 await deny(()=>as(a,admin,()=>a.query("select review_member_policy('post',$1,1,'clear','false_positive')",[sanction])));
 await clearRestriction();
 check((await read('post',await submit('post'))).status==='approved','Restriction reversed without Auth change');
 const audit=await as(a,admin,()=>a.query("select * from member_policy_queue('history')"));check(audit.rowCount>0,'History exists');check(!JSON.stringify(audit.rows).includes(owner),'No author identity in moderation UI');
 for(const field of ['status','edited_at','published_at','review_reason','policy_version','revision']){
  await deny(()=>as(a,owner,()=>a.query(`insert into questions(author_id,title,body,${field}) values($1,'Valid title','Valid body long enough',null)`,[owner])));
 }
 // Real independent-backend CAS waits with the FINAL policy applied.
 for(const kind of Object.keys(table)){
  const target=await submit(kind,'commercial');
  await a.query('begin;set local role authenticated');await a.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
  await mutation(a,kind,target,1,'edit',{body:'Changed sponsored content for review',commercial_disclosure:'commercial'});
  const pending=as(b,admin,()=>b.query("select review_member_policy($1,$2,1,'approve','commercial')",[kind,target])).then(()=>({ok:true}),e=>({code:e.code}));
  let blocked=false;for(let i=0;i<100;i++){if((await root.query('select cardinality(pg_blocking_pids($1))>0 blocked',[b.processID])).rows[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
  check(blocked,'Independent admin waiter observed');await a.query('commit');check((await pending).code==='PT409','Stale administrator rejected after wait');
  check((await read(kind,target)).status==='pending','Unreviewed revision cannot be published');
  await as(a,admin,()=>a.query("select review_member_policy($1,$2,2,'approve','commercial')",[kind,target]));
  const original=(await read(kind,target)).edited_at.toISOString();
  await as(a,admin,()=>a.query("select review_member_policy($1,$2,3,'hide','spam')",[kind,target]));
  check((await read(kind,target)).edited_at.toISOString()===original,'Review does not alter Edited');
  await deny(()=>as(a,other,()=>a.query("select report_member_content($1,$2,'spam')",[kind,target])));
  await deny(()=>as(a,admin,()=>a.query(`update ${table[kind]} set status='approved' where id=$1 returning id`,[target])).then(r=>{if(!r.rowCount)throw Object.assign(new Error('Denied by RLS'),{code:'42501'});}));
 }
 const video=await submit('post','personal','A personal YouTube caption','moment');
 check((await read('post',video)).status==='approved','YouTube-only personal Moment immediate');
 await as(a,owner,()=>mutation(a,'post',video,1,'edit',{body:'A new personal caption',commercial_disclosure:'personal'}));
 check((await read('post',video)).status==='approved','YouTube-only edit remains public');
 await deny(()=>as(a,owner,()=>mutation(a,'post',video,2,'edit',{youtube_title:'Forged provider metadata'})));
 check((await read('post',await submit('post','personal','Helpful personal travel tip','tip'))).status==='approved','Tip immediate');
 await deny(()=>submit('post','personal','Forged official prompt','discussion'));
 const official=await submit('post','personal','Genuine operator prompt','discussion',admin);
 check((await read('post',official)).status==='pending','Official prompt never auto-approved');
 // Warning, expiry, suspension, explicit reversal, deletion while suspended.
 const restricted=await submit('question');
 await as(a,admin,()=>a.query("select review_member_policy('question',$1,1,'warn','spam')",[restricted]));
 check((await read('post',await submit('post'))).status==='approved','Warning does not block writing');
 await as(a,admin,()=>a.query("select review_member_policy('question',$1,2,'suspend','spam')",[restricted]));
 for(const kind of Object.keys(table))await deny(()=>submit(kind));
 await deny(()=>as(a,admin,()=>a.query("select review_member_policy('question',$1,3,'warn','spam')",[restricted])));
 await as(a,owner,()=>mutation(a,'post',video,2,'delete'));
 check((await read('post',video)).deleted_at,'Suspended owner can delete');
 await clearRestriction();
 await as(a,admin,()=>a.query("select review_member_policy('question',$1,3,'restrict','spam')",[restricted]));
 await root.query("update member_content_private.restrictions set expires_at=now()-interval '1 second' where member_id=$1",[owner]);
 check((await read('post',await submit('post'))).status==='approved','Expired temporary restriction permits writing');
 check((await as(a,owner,()=>a.query('select * from my_writing_restriction()'))).rowCount===0,'Expired restriction not displayed as active');
 const ownState=await as(a,other,()=>a.query('select * from my_writing_restriction()'));check(ownState.rowCount===0,'Restriction status does not leak other members');
 // Actual photo grants, download-only policy, replaced/deleted image guards.
 const photo=id(++seq),replacement=id(++seq),alien=id(++seq);
 await root.query('insert into community_uploads(id,owner_id) values($1,$4),($2,$4),($3,$5)',[photo,replacement,alien,owner,other]);
 for(const media of [photo,replacement,alien])await root.query("insert into storage.objects(bucket_id,name) values('community-media',$1)",[media+'/image.webp']);
 const photograph=(await as(a,owner,()=>a.query("insert into community_posts(author_id,type,body,image_id,commercial_disclosure) values($1,'moment','Synthetic personal photograph',$2,'personal') returning id",[owner,photo]))).rows[0].id;
 check((await read('post',photograph)).status==='approved','Photo Moment immediate');
 await deny(()=>as(a,owner,()=>mutation(a,'post',photograph,1,'edit',{image_id:alien})));
 await as(a,owner,()=>mutation(a,'post',photograph,1,'edit',{image_id:replacement,commercial_disclosure:'personal'}));
 check((await read('post',photograph)).status==='approved','Personal photo replacement remains public');
 for(const who of [null,owner,other,admin])check(!(await as(a,who,()=>a.query('select community_media_allowed($1) ok',[photo+'/image.webp']))).rows[0].ok,'Replaced photo hidden');
 await as(a,owner,()=>mutation(a,'post',photograph,2,'delete'));
 for(const who of [null,owner,other,admin])check(!(await as(a,who,()=>a.query('select community_media_allowed($1) ok',[replacement+'/image.webp']))).rows[0].ok,'Deleted photo hidden');
 // Reply ancestor visibility after general, instant publication.
 const parent=await submit('comment');
 const reply=(await as(a,other,()=>a.query("insert into community_comments(post_id,parent_comment_id,body,commercial_disclosure) values($1,$2,'Synthetic personal reply','personal') returning id",[id(6),parent]))).rows[0].id;
 check((await read('comment',reply)).status==='approved','Reply immediate');
 await as(a,owner,()=>mutation(a,'comment',parent,1,'delete'));
 for(const who of [null,owner,other,admin])check((await as(a,who,()=>a.query('select body from community_comments where id=$1',[reply]))).rowCount===0,'Deleted ancestor reply hidden for all app roles');
 const appeal=await submit('post');
 await as(a,admin,()=>a.query("select review_member_policy('post',$1,1,'suspend','spam')",[appeal]));
 await as(a,owner,()=>mutation(a,'post',appeal,2,'delete'));
 const cases=(await as(a,admin,()=>a.query("select * from member_policy_queue('restrictions')"))).rows.map(r=>r.member_policy_queue);
 check(cases.length===1&&!JSON.stringify(cases).includes(owner),'Restriction review has no member ID or deleted source');
 const c=cases[0];
 for(const who of [null,owner,other])await deny(()=>as(a,who,()=>a.query('select clear_member_writing_restriction($1,$2)',[c.id,c.revision])));
 await deny(()=>as(a,admin,()=>a.query('select clear_member_writing_restriction($1,$2)',[c.id,c.revision-1])));
 await as(a,admin,()=>a.query('select clear_member_writing_restriction($1,$2)',[c.id,c.revision]));
 check((await read('post',appeal)).deleted_at,'Sanction reversal never restores deleted source');
 check((await read('post',await submit('post'))).status==='approved','Deleted-target suspension remains reversible');
 await deny(()=>as(a,admin,()=>a.query('select clear_member_writing_restriction($1,$2)',[c.id,c.revision])));
 const linked=await submit('post'),cluster=id(++seq);
 await root.query("insert into content_clusters(id,slug,title,summary,introduction,status) values($1,'selective-policy','Synthetic cluster','Synthetic summary','Synthetic introduction','published')",[cluster]);
 await root.query('insert into content_cluster_items(cluster_id,community_post_id) values($1,$2)',[cluster,linked]);
 await as(a,other,()=>a.query("insert into community_helpful(post_id,reaction_type) values($1,'like')",[linked]));
 await root.query("insert into conversation_translations(content_type,content_id,source_language,target_language,source_hash,translated_text,provider,model) values('post',$1,'en','ja',repeat('a',64),'Synthetic cached translation','synthetic','synthetic')",[linked]);
 await as(a,admin,()=>mutation(a,'post',linked,1,'feature'));
 check((await read('post',linked)).is_featured&&(await read('post',linked)).edited_at===null,'Featured remains admin-only and not an author edit');
 await as(a,owner,()=>mutation(a,'post',linked,2,'delete'));
 for(const who of [null,owner,other,admin]){
  check((await as(a,who,()=>a.query("select body from community_posts where id=$1 and status='approved'",[linked]))).rowCount===0,'Translation source/UUID/feed denied after delete');
  await deny(()=>as(a,who,()=>a.query('select translated_text from conversation_translations where content_id=$1',[linked])));
  check((await as(a,who,()=>a.query('select community_post_id from content_cluster_items where cluster_id=$1',[cluster]))).rowCount===0,'Cluster indirect link hidden');
  check((await as(a,who,()=>a.query('select * from conversation_reaction_counts($1)',[linked]))).rowCount===0,'Reaction aggregate hidden');
  check((await as(a,who,()=>a.query('select * from conversation_activity($1)',[[linked]]))).rowCount===0,'Homepage activity hidden');
 }
 console.log(JSON.stringify({result:'PASS',assertions:passed,scope:'selective policy; actual isolated PostgreSQL; no hosted HTTP'}));
}catch(e){console.error(JSON.stringify({result:'FAIL',assertions:passed,code:e.code??'ASSERTION',message:e.code?e.message:e.message}));process.exitCode=1;}
finally{for(const c of clients)await c.end();if(created)await ctl.query(`drop database ${database}`);await ctl.end();}
