// Real new migration, isolated PostgreSQL/WASM only. No env/network/production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH??'node_modules/.cache/privacy-db-runtime/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',hash='a'.repeat(64);
const query=async sql=>(await db.query(sql)).rows;
const role=async r=>db.exec(`reset role;set role ${r}`);
const claim=(h=hash)=>`select public.claim_conversation_translation('post','${id}','ko','en','${h}','${id}','fixture','fixture-model') as r`;
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${id}');grant usage on schema public to anon,authenticated,service_role;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261006000000_conversation_translations.sql','utf8'));
 for(const r of ['anon','authenticated']){
  await role(r);
  for(const table of ['conversation_translations','conversation_translation_attempts']){
   for(const sql of [`select * from public.${table}`,`select count(*) from public.${table}`,`delete from public.${table}`,`insert into public.${table} default values`])await assert.rejects(()=>db.query(sql),e=>e.code==='42501');
  }
  await assert.rejects(()=>db.query(claim()),e=>e.code==='42501');
  await assert.rejects(()=>db.query(`select public.finish_conversation_translation('${id}','${id}','poison')`),e=>e.code==='42501');
  await assert.rejects(()=>db.query(`update public.conversation_translations set translated_text='poison'`),e=>e.code==='42501');
 }
 await role('service_role');
 const first=(await query(claim()))[0].r;assert.equal(first.state,'claimed');
 assert.equal((await query(claim()))[0].r.state,'busy');
 assert.equal((await query(`select count(*)::int as n from public.conversation_translation_attempts`))[0].n,1);
 assert.equal((await query(`select public.finish_conversation_translation('${first.id}','${id}','wrong lease') as ok`))[0].ok,false);
 assert.equal((await query(`select public.finish_conversation_translation('${first.id}','${first.lease}','Translated text') as ok`))[0].ok,true);
 assert.equal((await query(claim()))[0].r.state,'hit');
 await db.exec('reset role; grant select on public.conversation_translations to anon; set role anon;');
 assert.equal((await query('select count(*)::int as n from public.conversation_translations'))[0].n,0,'RLS independently denies rows even if table SELECT is accidentally granted');
 await db.exec('reset role; revoke select on public.conversation_translations from anon;');
 await role('service_role');
 assert.equal((await query(`select count(*)::int as n from public.conversation_translation_attempts`))[0].n,1,'Hit no quota');
 await assert.rejects(()=>db.query(`insert into public.conversation_translations(content_type,content_id,source_language,target_language,source_hash,provider,model) values('post','${id}','ko','en','${hash}','fixture','fixture-model')`),e=>e.code==='23505');
 for(const [field,value]of [['source_language',"'ja'"],['target_language',"'ko'"],['content_type',"'question'"],['source_hash',"'bad'"],['translated_text',"' '" ]])await assert.rejects(()=>db.query(`update public.conversation_translations set ${field}=${value}`),e=>e.code==='23514');
 for(let i=1;i<=4;i++)assert.equal((await query(claim(String(i).repeat(64))))[0].r.state,'claimed');
 assert.equal((await query(claim('b'.repeat(64))))[0].r.state,'limited');
 await db.exec(`reset role;update public.conversation_translation_attempts set created_at=now()-interval '2 minutes';`);
 await role('service_role');assert.equal((await query(claim('b'.repeat(64))))[0].r.state,'claimed');
 await db.exec(`reset role;insert into public.conversation_translation_attempts(actor_id,created_at) select '${id}',now()-interval '1 hour' from generate_series(1,14);`);
 await role('service_role');assert.equal((await query(claim('c'.repeat(64))))[0].r.state,'limited','20/day');
 await db.exec(`reset role;insert into auth.users values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');insert into public.conversation_translation_attempts(actor_id,created_at) select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now()-interval '1 hour' from generate_series(1,480);`);
 await role('service_role');assert.equal((await query(claim('d'.repeat(64)).replaceAll(id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc')))[0].r.state,'limited','Global 500/day before attempt insert');
 await db.exec(`reset role;update public.conversation_translations set lease_until=now()-interval '1 second' where id='${first.id}';`);
 await role('service_role');assert.equal((await query(`select public.finish_conversation_translation('${first.id}','${first.lease}','Late result') as ok`))[0].ok,false);
 await role('postgres');
 assert.equal((await query(`select count(*)::int as n from pg_proc where proname in ('claim_conversation_translation','finish_conversation_translation') and prosecdef`))[0].n,0);
 assert.equal((await query(`select count(*)::int as n from pg_class where relname in ('conversation_translations','conversation_translation_attempts') and relrowsecurity`))[0].n,2);
 console.log('PASS: actual translation SQL, RLS/grants deny cache/count/poisoning, service-only invoker RPCs, uniqueness, lease fencing, rolling quotas, no SECURITY DEFINER.');
}finally{await db.close();}
