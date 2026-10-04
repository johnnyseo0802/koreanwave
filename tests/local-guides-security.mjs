// Real PostgreSQL in WASM, local fixtures only; no Supabase/env/network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH??'node_modules/.cache/privacy-db-runtime/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite();
const read=p=>readFileSync(p,'utf8');
const admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const member='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
 create table public.profiles(id uuid,role text); alter table public.profiles enable row level security;
 grant select(id,role) on public.profiles to authenticated;
 create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
 insert into public.profiles values ('${admin}','admin'),('${member}','member');`);
 await db.exec(read('supabase/migrations/20260925000000_create_editorial_articles.sql'));
 const payload=(section,category)=>`(section,category,title,summary,body) values ('${section}','${category}','Fixture guide','A useful fixture summary','A sufficiently long fixture body for testing.')`;
 for(const [s,c] of [['k-contents','music'],['k-contents','dramas'],['k-contents','movies'],['k-trends','beauty'],['k-trends','fashion'],['k-trends','food']]) await db.exec(`insert into public.editorial_articles ${payload(s,c)}`);
 const before=(await db.query('select * from public.editorial_articles order by id')).rows;
 await db.exec(read('supabase/migrations/20261004000000_local_korea_editorial_guides.sql'));
 assert.deepEqual((await db.query('select * from public.editorial_articles order by id')).rows,before);
 for(const [s,c] of [['local-korea','food'],['k-trends','guides'],['k-contents','guides'],['local-korea','places']]) await assert.rejects(()=>db.exec(`insert into public.editorial_articles ${payload(s,c)}`),e=>e.code==='23514');
 async function as(role,id=''){await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id}',false)`);}
 await as('anon'); await assert.rejects(()=>db.exec(`insert into public.editorial_articles ${payload('local-korea','guides')}`),e=>e.code==='42501');
 await as('authenticated',member); await assert.rejects(()=>db.exec(`insert into public.editorial_articles ${payload('local-korea','guides')}`),e=>e.code==='42501');
 await as('authenticated',admin);
 const id=(await db.query(`insert into public.editorial_articles ${payload('local-korea','guides')} returning id`)).rows[0].id;
 for(const role of ['anon','authenticated']) {await as(role,member);assert.equal((await db.query(`select id from public.editorial_articles where id='${id}'`)).rows.length,0);}
 await as('authenticated',admin);
 assert.equal((await db.query(`select id from public.editorial_articles where id='${id}'`)).rows.length,1);
 await assert.rejects(()=>db.exec(`update public.editorial_articles set published_at=now() where id='${id}'`),e=>e.code==='42501');
 await db.exec(`update public.editorial_articles set status='published' where id='${id}'`);
 await as('anon'); assert.ok((await db.query(`select published_at from public.editorial_articles where id='${id}'`)).rows[0].published_at);
 await as('authenticated',member);assert.equal((await db.query(`update public.editorial_articles set title='Not allowed' where id='${id}' returning id`)).rows.length,0);
 await as('authenticated',admin);await db.exec(`update public.editorial_articles set status='draft' where id='${id}'`);
 assert.equal((await db.query(`select published_at from public.editorial_articles where id='${id}'`)).rows[0].published_at,null);
 await as('anon');assert.equal((await db.query(`select id from public.editorial_articles where id='${id}'`)).rows.length,0);
 console.log('PASS: Guides constraint, six legacy combinations/rows preserved, admin draft/preview/publish/unpublish, anon/member denial, draft privacy and DB-owned dates. Isolated PostgreSQL only.');
} finally {await db.close();}
