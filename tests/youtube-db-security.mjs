// Actual migrations in isolated PostgreSQL/WASM. No env, network or production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH??'node_modules/.cache/privacy-db-runtime/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(),read=p=>fs.readFileSync(p,'utf8');
const id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const owner=id(1),member=id(2),admin=id(3),stranger=id(4),post=id(10),otherPost=id(11),hidden=id(12),article=id(20),draft=id(21);
const rows=async sql=>(await db.query(sql)).rows;
const denied=async(sql,codes=['42501'])=>assert.rejects(()=>db.query(sql),e=>codes.includes(e.code));
const as=async(role,who='')=>db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${who}',false);`);
const root=async()=>db.exec('reset role');
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to anon,authenticated;
 create table public.profiles(id uuid primary key,role text,display_name text);
 alter table public.profiles enable row level security;
 grant select on public.profiles to authenticated;
 create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 create table public.questions(id uuid,author_id uuid,title text,body text,status text,created_at timestamptz);
 create table public.answers(id uuid,author_id uuid,question_id uuid,body text,status text,created_at timestamptz);
 create table public.reviews(id uuid,author_id uuid,place_id uuid,body text,status text,created_at timestamptz);
 create table public.editorial_articles(id uuid primary key,title text,status text);
 alter table public.editorial_articles enable row level security;
 grant select(id,title,status) on public.editorial_articles to anon,authenticated;
 create policy public_articles on public.editorial_articles for select using(status='published');
 insert into auth.users values ('${owner}'),('${member}'),('${admin}'),('${stranger}');
 insert into public.profiles values ('${owner}','member','PRIVATE_NAME'),('${member}','member','PRIVATE_NAME'),('${admin}','admin','PRIVATE_NAME'),('${stranger}','member','PRIVATE_NAME');`);
 await db.exec(read('supabase/migrations/20260928000000_community_participation.sql'));
 // Local legacy fixture, not a seed or remote content. Migration preserves its semantics.
 await db.exec(`insert into public.community_posts(id,author_id,type,title,body,status,published_at) values
 ('${post}','${owner}','story','Local fixture','Local in-memory fixture story','approved',now()),
 ('${otherPost}','${owner}','story','Other local fixture','Local in-memory fixture story','approved',now()),
 ('${hidden}','${owner}','story','Private fixture','Local in-memory fixture story','pending',null);
 insert into public.community_helpful(post_id,member_id) values ('${post}','${member}');
 insert into public.editorial_articles values ('${article}','Article fixture','published'),('${draft}','Draft fixture','draft');`);

 await db.exec(read('supabase/migrations/20261005000000_community_conversations.sql'));
 await db.exec(`insert into public.community_uploads(id,owner_id) values ('${id(50)}','${owner}');
 insert into storage.objects(bucket_id,name) values ('community-media','${id(50)}/image.webp');
 insert into public.community_posts(id,author_id,type,body,image_id) values ('${id(51)}','${owner}','moment','Legacy photo','${id(50)}');`);
 const legacy=await rows('select id,type,title,body,image_id,image_alt,status,published_at from community_posts order by id');
 const policies=await rows("select * from pg_policies order by schemaname,tablename,policyname");
 const triggers=await rows("select tgname,pg_get_triggerdef(oid) def from pg_trigger where not tgisinternal order by tgname");
 await db.exec(read('supabase/migrations/20261016000000_community_youtube_moments.sql'));
 assert.deepEqual(await rows('select id,type,title,body,image_id,image_alt,status,published_at from community_posts order by id'),legacy);
 assert.deepEqual(await rows("select * from pg_policies order by schemaname,tablename,policyname"),policies);
 assert.deepEqual(await rows("select tgname,pg_get_triggerdef(oid) def from pg_trigger where not tgisinternal order by tgname"),triggers);
 const video=(extra='')=>`insert into community_posts(author_id,type,body,youtube_video_id,youtube_title,youtube_channel_name${extra}) values ('${owner}','moment','My original opinion','dQw4w9WgXcQ','Video title','Channel'`;
 await as('anon'); await denied(video()+')');
 await as('authenticated',owner);
 await db.exec(video()+')');
 const vid=(await rows("select id from community_posts where youtube_video_id='dQw4w9WgXcQ'"))[0].id;
 assert.equal((await rows(`select status,published_at from community_posts where id='${vid}'`))[0].status,'pending');
 await denied(video(',status')+",'approved')"); await denied(video(',published_at')+",now())");
 await denied(`insert into community_posts(author_id,type,body,youtube_video_id,youtube_title,youtube_channel_name) values ('${member}','moment','Forged author','dQw4w9WgXcQ','Title','Channel')`);
 for(const sql of [
 video(',image_id')+`,'${id(50)}')`,
 "insert into community_posts(author_id,type,body) values ('"+owner+"','moment','Missing media')"
 ]) await denied(sql,['23514','23505']);
 await denied(video().replace('dQw4w9WgXcQ','invalid')+')',['23514']);
 await denied(video().replace("'moment'","'story'")+')',['23514']);
 await denied(video().replace("'Video title'","null")+')',['23514']);
 await denied(`update community_posts set youtube_title='Changed' where id='${vid}'`);
 await denied('select author_id from community_posts');
 await as('anon');assert.equal((await rows(`select id,youtube_video_id from community_posts where id='${vid}'`)).length,0);
 await as('authenticated',member);assert.equal((await rows(`select id from community_posts where id='${vid}'`)).length,0);
 assert.equal((await rows(`update community_posts set status='approved' where id='${vid}' returning id`)).length,0);
 await as('authenticated',admin);
 await db.exec(`update community_posts set status='approved' where id='${vid}'`);
 await denied(`update community_posts set youtube_video_id='aaaaaaaaaaa' where id='${vid}'`);
 await as('anon');assert.equal((await rows(`select youtube_video_id,published_at from community_posts where id='${vid}'`))[0].youtube_video_id,'dQw4w9WgXcQ');
 await as('authenticated',admin);await db.exec(`update community_posts set status='rejected' where id='${vid}'`);
 await as('anon');assert.equal((await rows(`select id from community_posts where id='${vid}'`)).length,0);
 await root();
 for(const role of ['anon','authenticated']){
 const grants=await rows(`select has_column_privilege('${role}','community_posts','youtube_video_id','SELECT') s,has_column_privilege('${role}','community_posts','youtube_video_id','INSERT') i,has_column_privilege('${role}','community_posts','youtube_video_id','UPDATE') u`);
 assert.equal(grants[0].s,true);assert.equal(grants[0].i,role==='authenticated');assert.equal(grants[0].u,false);
 }
 console.log('PASS: actual PostgreSQL migration; legacy rows unchanged; exact-one media; invalid ID/type/metadata denied; anon INSERT denied; forged owner/status/date denied; owner/private and public approved/rejected visibility; member moderation denied; admin moderation retained; column ACLs and all RLS/triggers unchanged.');
} finally {await db.close();}
