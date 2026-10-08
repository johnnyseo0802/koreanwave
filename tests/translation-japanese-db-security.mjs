// Actual forward migration against an isolated PostgreSQL database, never remote.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH??'node_modules/.cache/privacy-db-runtime/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',hash='a'.repeat(64);
const rows=async sql=>(await db.query(sql)).rows;
const role=async r=>db.exec(`reset role;set role ${r}`);
const snapshot=()=>rows(`select 'function' kind,proname name,pg_get_functiondef(oid) definition,proacl::text privileges from pg_proc where proname in ('claim_conversation_translation','finish_conversation_translation') union all select 'table',relname,relrowsecurity::text,relacl::text from pg_class where relname in ('conversation_translations','conversation_translation_attempts') union all select 'index',indexname,indexdef,null from pg_indexes where tablename in ('conversation_translations','conversation_translation_attempts') order by 1,2`);
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${id}');grant usage on schema public to anon,authenticated,service_role;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261006000000_conversation_translations.sql','utf8'));
 await db.exec(`insert into public.conversation_translations(content_type,content_id,source_language,target_language,source_hash,translated_text,provider,model) values('post','${id}','ko','en','${hash}','Original cached translation','fixture','fixture');`);
 const before=await snapshot(),legacy=await rows('select * from public.conversation_translations');
 await db.exec(fs.readFileSync('supabase/migrations/20261008000000_conversation_translation_japanese.sql','utf8'));
 assert.deepEqual(await snapshot(),before,'RPCs, grants, RLS and unique/cache indexes unchanged');
 assert.deepEqual(await rows('select * from public.conversation_translations'),legacy,'Existing cache untouched');
 for(const r of ['anon','authenticated']){
  await role(r);
  for(const sql of ['select * from public.conversation_translations',`insert into public.conversation_translations default values`,`select public.claim_conversation_translation('post','${id}','ja','en','${hash}','${id}','fixture','fixture')`])await assert.rejects(()=>db.query(sql),e=>e.code==='42501');
 }
 await role('service_role');
 const entries=[];
 for(const source of ['en','ko','ja'])for(const target of ['en','ko','ja']){
  if(source===target)continue;
  // Separate actor per direction avoids consuming the unchanged 5/min allowance.
  const actor=`bbbbbbbb-bbbb-4bbb-8bbb-${String(entries.length+1).padStart(12,'0')}`;
  await db.exec(`reset role;insert into auth.users values('${actor}');set role service_role;`);
  const sql=`select public.claim_conversation_translation('comment','${id}','${source}','${target}','${hash}','${actor}','fixture','fixture') as r`;
  const claim=(await rows(sql))[0].r;assert.equal(claim.state,'claimed');
  assert.equal((await rows(sql))[0].r.state,'busy');
  assert.equal((await rows(`select public.finish_conversation_translation('${claim.id}','${claim.lease}','Safe fixture translation') as ok`))[0].ok,true);
  assert.equal((await rows(sql))[0].r.state,'hit');entries.push(claim.id);
 }
 assert.equal(entries.length,6);assert.equal(new Set(entries).size,6);
 assert.equal((await rows('select count(*)::int as n from public.conversation_translation_attempts'))[0].n,6,'Hits do not use quota');
 for(const [source,target]of [['ja','ja'],['en','en'],['ko','ko'],['zh','en'],['en','zh']])await assert.rejects(()=>db.query(`insert into public.conversation_translations(content_type,content_id,source_language,target_language,source_hash,provider,model) values('post','${id}','${source}','${target}','${hash}','fixture','fixture')`),e=>e.code==='23514');
 await assert.rejects(()=>db.query(`insert into public.conversation_translations(content_type,content_id,source_language,target_language,source_hash,provider,model) values('comment','${id}','ja','en','${hash}','fixture','fixture')`),e=>e.code==='23505');
 console.log('PASS: Japanese forward SQL; six directions through existing RPC, cache hit/lease/unique, EN/KO rows preserved, same-language/unsupported denied, browser grants/RLS and all RPC/quotas unchanged. Isolated DB only.');
}finally{await db.close();}
