// Isolated fixtures only. Never reads .env or contacts Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
const read = p => fs.readFileSync(p, 'utf8');
function load(path, imports = {}) {
  const context = { exports: {}, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co' } }, URL, FormData, File, Uint8Array, crypto: { randomUUID }, require: n => n === 'server-only' ? {} : imports[n] };
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const model = load('src/lib/editorial.ts'), media = load('src/lib/media.ts'), discovery = load('src/lib/discovery.ts');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const image = `https://fixture.supabase.co/storage/v1/object/public/site-media/images/${id}.png`;
assert.equal(media.safeMediaUrl(image), image);
for (const bad of [image+'?x=1', image+'#x', image.replace('/images/', '/x/../images/'), image.replace('fixture.', 'other.'), image.replace('public/site-media','public/private'), image.replace('.png','.svg'), 'http://127.0.0.1/x', '//evil.org/x', image.replace('/images/', '/images/%2e%2e/'), image.replace('https://', 'https://user:password@')]) assert.equal(media.safeMediaUrl(bad), null);
const png = new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])], '../../private.png', { type: 'image/png' });
assert.equal(await media.validateImage(png), 'png');
assert.equal(await media.validateImage(new File(['<svg/>'], 'x.png', { type: 'image/png' })), null);
assert.equal(await media.validateImage(new File([new Uint8Array(2097153)], 'x.png', { type: 'image/png' })), null);
assert.equal(await media.validateImage(new File(['x'], 'x.svg', { type: 'image/svg+xml' })), null);
assert.equal(discovery.searchTerm(['secret']), '');
assert.equal(discovery.searchTerm('a'.repeat(200)).length, 80);
assert.doesNotMatch(discovery.searchTerm('%,status.eq.draft),or(x)&\\_'), /[%.,()&\\_]/);

let calls = [], result = { data: [], error: null };
const chain = new Proxy({}, { get: (_, name) => name === 'then' ? resolve => Promise.resolve(result).then(resolve) : (...args) => { calls.push([name, ...args]); return chain; } });
const client = { from: table => { calls.push(['from', table]); return chain; } };
const data = load('src/lib/discovery-data.ts', { '@/lib/discovery': discovery, '@/lib/editorial': model, '@/lib/supabase/server': { createClient: async () => client } });
await data.searchPublicContent('Seoul');
assert.deepEqual(calls.filter(c=>c[0]==='from').map(c=>c[1]).sort(), ['editorial_articles','experiences','places']);
assert.equal(calls.filter(c=>c[0]==='eq' && c[1]==='status' && c[2]==='published').length, 3);
assert.equal(calls.filter(c=>c[0]==='limit' && c[1]===20).length, 3);
for (const c of calls.filter(c=>c[0]==='select')) assert.doesNotMatch(c[1], /\*|author|member|meeting|profile/);
calls=[]; await data.searchPublicContent(''); assert.equal(calls.length,0);
result={data:null,error:{message:'PRIVATE_ERROR'}};
assert.equal((await data.searchPublicContent('Seoul')).unavailable,true);
assert.equal(await data.getLocalItem('places',id),null);
assert.ok(calls.some(c=>c[0]==='eq' && c[1]==='status' && c[2]==='published'));

const managed=load('src/lib/managed-content.ts',{'@/lib/editorial':model,'@/lib/media':media});
const form=new FormData();
for(const [k,v] of Object.entries({name:'Seoul place',area:'Seoul',category:'Walk',description:'A useful local discovery.',visitor_info:'',status:'published',image_url:'',image_alt:'',author_id:'forged',published_at:'forged'})) form.set(k,v);
let access={status:'forbidden'};
const actions=load('src/app/admin/local-content/actions.ts',{'@/lib/auth/admin-access':{getAdminAccess:async()=>access},'@/lib/editorial':model,'@/lib/managed-content':managed,'next/cache':{revalidatePath(){}}});
calls=[]; assert.equal((await actions.saveManaged('places',id,'2026-09-27T00:00:00Z',form)).ok,false); assert.equal(calls.length,0);
access={status:'admin',client}; result={data:{id,updated_at:'2026-09-27T00:01:00Z'},error:null};
assert.equal((await actions.saveManaged('profiles',id,'2026-09-27T00:00:00Z',form)).ok,false);
assert.equal((await actions.saveManaged('places',id,'2026-09-27T00:00:00Z',form)).ok,true);
assert.deepEqual(Object.keys(calls.find(c=>c[0]==='update')[1]).sort(),['area','category','description','image_alt','image_url','name','status','visitor_info']);
assert.ok(calls.some(c=>c[0]==='eq' && c[1]==='updated_at'));
result={data:null,error:null}; assert.equal((await actions.saveManaged('places',id,'2026-09-27T00:00:00Z',form)).ok,false);
form.set('description','short'); assert.ok(managed.validateManaged('places',form).error);

let uploads=0;
const storage={from:bucket=>{assert.equal(bucket,'site-media');return {upload:async(path,_file,options)=>{uploads++;assert.match(path,media.mediaPathPattern);assert.equal(options.upsert,false);assert.ok(!path.includes('private'));return {error:null};},getPublicUrl:()=>({data:{publicUrl:image}})};}};
const upload=load('src/app/admin/media/upload/route.ts',{'@/lib/auth/admin-access':{getAdminAccess:async()=>access},'@/lib/media':media,'next/server':{NextResponse:{json:(body,init)=>({body,...init})}}});
const uploadForm=new FormData();uploadForm.set('file',png);
const req={url:'http://localhost/admin/media/upload',headers:new Headers({origin:'http://localhost','content-length':'1024'}),formData:async()=>uploadForm};
access={status:'forbidden'};assert.equal((await upload.POST(req)).status,403);assert.equal(uploads,0);
access={status:'admin',client:{storage}};assert.equal((await upload.POST(req)).status,201);assert.equal(uploads,1);
req.headers.set('origin','https://external.test');assert.equal((await upload.POST(req)).status,403);assert.equal(uploads,1);

const sql=read('supabase/migrations/20260927000000_site_media_discovery.sql');
assert.match(sql,/begin;[\s\S]*commit;/);
assert.equal((sql.match(/create policy site_media_(?:insert|update|delete)_guard/g)||[]).length,3);
assert.match(sql,/as restrictive for insert to authenticated/);
assert.match(sql,/file_size_limit, allowed_mime_types/);
assert.match(sql,/2097152, array\['image\/jpeg','image\/png','image\/webp'\]/);
assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/drop |update public\.|grant (?:all|update on|delete)/i);
for(const table of ['places','experiences','events']) {
 assert.match(sql,new RegExp(`create policy ${table}_admin_edit[\\s\\S]*?p.role = 'admin'`));
 assert.match(sql,new RegExp(`grant update \\([^;]+\\) on public.${table} to authenticated`));
}
for(const grant of sql.matchAll(/grant (?:insert|update) \(([^)]+)\)/g)) assert.doesNotMatch(grant[1],/published_at|created_at|updated_at|\bid\b/);
for(const p of ['src/components/home-discovery.tsx','src/lib/discovery-data.ts']) {
 const source=read(p);assert.doesNotMatch(source,/event_applications|event_meeting_details|author_id|member_id|\.select\(["']\*/);
 assert.match(source,/\.eq\("status", "published"\)/);
}
assert.match(read('src/components/home-discovery.tsx'),/\.eq\("status", "approved"\)/);
assert.match(read('src/app/search/page.tsx'),/index: false/);
assert.match(read('next.config.ts'),/maximumRedirects: 0/);
const drafts=JSON.parse(read('docs/content/sprint-6-editorial-drafts.json'));
assert.equal(drafts.length,24);
for(const draft of drafts){const f=new FormData();for(const [k,v] of Object.entries(draft))if(typeof v==='string')f.set(k,v);assert.ok(model.validateEditorial(f).value);assert.equal(draft.status,'draft');assert.equal(draft.image_url,null);}
console.log('PASS: discovery public filters/bounds/failures, image host/path/MIME/size, admin-only mocked upload/edit, stale writes, no mass assignment, homepage privacy, storage policy/static grants and 24 draft entries. No remote calls/writes.');
