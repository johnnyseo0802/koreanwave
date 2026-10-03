// Isolated PostgreSQL (PGlite), never Supabase. No env files or remote credentials.
// Runtime is test-only, not a project dependency. See launch pack README.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const modulePath=process.env.PGLITE_MODULE_PATH ?? 'node_modules/.cache/privacy-db-runtime/node_modules/@electric-sql/pglite/dist/index.js';
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261002000000_questions_author_privacy.sql');
const uid=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const owner=uid(1),other=uid(2),admin=uid(3),approved=uid(11),pending=uid(12),rejected=uid(13);
async function rows(sql){return (await db.query(sql)).rows;}
async function denied(sql){await assert.rejects(()=>db.query(sql),e=>e.code==='42501');}
async function as(role,id=''){await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id}',false);`);}
try{
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 create table public.profiles(id uuid primary key,role text not null);
 alter table public.profiles enable row level security;
 grant select(id,role) on public.profiles to authenticated;
 create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
 insert into auth.users values ('${owner}'),('${other}'),('${admin}');
 insert into public.profiles values ('${owner}','member'),('${other}','member'),('${admin}','admin');`);
 await db.exec(read('supabase/migrations/20260923000000_create_questions.sql'));
 await db.exec(read('supabase/migrations/20260923010000_add_question_moderation.sql'));
 await db.exec(read('supabase/migrations/20260923020000_create_answers.sql'));
 // Minimal unrelated tables only to execute the EXISTING own-contributions RPC.
 await db.exec(`create table public.community_posts(id uuid,type text,title text,body text,status text,created_at timestamptz,is_featured boolean,author_id uuid);
 create table public.reviews(id uuid,body text,status text,created_at timestamptz,place_id uuid,author_id uuid);`);
 const contributions=read('supabase/migrations/20260928000000_community_participation.sql');
 await db.exec(contributions.slice(contributions.indexOf('create function public.my_community_contributions()'),contributions.indexOf('-- Review/operations:')));
 await db.exec(`insert into public.questions(id,author_id,title,body,status,published_at) values
 ('${approved}','${owner}','Approved fixture','Approved fixture question body','approved',now()),
 ('${pending}','${owner}','Pending fixture','Pending fixture question body','pending',null),
 ('${rejected}','${owner}','Rejected fixture','Rejected fixture question body','rejected',null);`);
 // Unexpected inherited permissions must abort, not silently preserve a leak.
 await db.exec('create role privacy_legacy_reader; grant select(author_id) on public.questions to privacy_legacy_reader; grant privacy_legacy_reader to anon;');
 await assert.rejects(()=>db.exec(migration),e=>e.code==='P0001');
 await db.exec('rollback;');
 assert.equal((await rows("select has_table_privilege('anon','public.questions','SELECT') as restored"))[0].restored,true);
 assert.equal((await rows("select to_regprocedure('public.admin_question_identity(uuid)') as f"))[0].f,null);
 await db.exec('revoke privacy_legacy_reader from anon;');
 await db.exec(migration);
 assert.equal((await rows("select to_regprocedure('public.admin_question_identity(uuid)') as f"))[0].f,null);
 await as('anon');
 assert.equal((await rows('select id,title,body,status,published_at from public.questions')).length,1);
 for(const sql of ['select author_id from public.questions','select * from public.questions',`select id from public.questions where author_id='${owner}'`,'select id from public.questions order by author_id'])await denied(sql);
 // Exact safe question fields/filter used by cluster linking, under each role.
 const linked=`select q.id,q.title,q.body from (values ('${approved}'::uuid),('${pending}'::uuid),('${rejected}'::uuid)) as i(question_id) join public.questions q on q.id=i.question_id where q.status='approved'`;
 assert.equal((await rows(linked)).length,1);
 assert.equal((await rows("select id from public.questions where status in ('pending','rejected')")).length,0);
 await as('authenticated',other);
 assert.equal((await rows('select id from public.questions')).length,1);
 await denied('select author_id from public.questions');
 assert.equal((await rows(linked)).length,1);
 assert.equal((await rows('select * from public.my_community_contributions()')).length,0);
 await as('authenticated',owner);
 assert.equal((await rows('select id,title,body,status,created_at,updated_at from public.questions')).length,3);
 assert.equal((await rows('select * from public.my_community_contributions()')).length,3);
 await denied('select author_id from public.questions');
 assert.equal((await rows(linked)).length,1);
 await db.exec(`insert into public.questions(author_id,title,body) values ('${owner}','New local fixture','Only in the in-memory test database');`);
 await denied(`insert into public.questions(author_id,title,body) values ('${other}','Spoof fixture','Only in the in-memory test database')`);
 await db.exec(`insert into public.answers(question_id,author_id,body) values ('${approved}','${owner}','Local answer');`);
 await denied(`insert into public.answers(question_id,author_id,body) values ('${pending}','${owner}','Denied answer')`);
 assert.equal((await rows(`update public.questions set status='approved' where id='${pending}' returning id`)).length,0);
 await as('authenticated',admin);
 assert.equal((await rows('select id,title,body,status,created_at from public.questions')).length,4);
 assert.equal((await rows(linked)).length,1);
 assert.equal((await rows(`select id,title from public.questions where id='${approved}'`)).length,1);
 await denied('select author_id from public.questions');
 assert.equal((await rows(`update public.questions set status='approved' where id='${pending}' and status='pending' returning id`)).length,1);
 assert.equal((await rows(`update public.questions set status='rejected' where id='${pending}' and status='pending' returning id`)).length,0);
 // Revoked admin can no longer read another author's private moderation rows.
 await db.exec(`reset role; update public.profiles set role='member' where id='${admin}';`);
 await as('authenticated',admin);
 assert.equal((await rows(`select id from public.questions where id='${rejected}'`)).length,0);
 await as('authenticated');
 assert.equal((await rows(`select id from public.questions where id='${rejected}'`)).length,0);
 assert.doesNotMatch(migration,/create\s+(?:or\s+replace\s+)?(?:function|view|policy)|security\s+definer|admin_question_identity|alter policy|storage\.|service_role|drop\s/i);
 for(const path of ['src/app/admin/questions/page.tsx','src/app/admin/questions/actions.ts','src/app/admin/answers/page.tsx'])assert.doesNotMatch(read(path),/author_id|admin_question_identity/);
 console.log('PASS: isolated PostgreSQL grants/RLS; no new identity RPC; anon/member/admin direct author SELECT denied; public/cluster fields, owner contributions/submission, answers and admin moderation retained; inherited-grant rollback and revoked-admin checks. No production access.');
}finally{await db.close();}
