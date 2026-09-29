// No env files, remote services or real credentials. SQL static + executable mocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const read=p=>fs.readFileSync(p,'utf8');
const environment={SUPABASE_COMMUNITY_MEDIA_SECRET_KEY:'sb_secret_fixture_not_a_real_key',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid'};
function load(path,imports={}){
  const ctx={exports:{},Buffer,Uint8Array,FormData,File,Response,URL,process:{env:environment},require:n=>n==='server-only'?{}:imports[n]};
  vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,ctx);return ctx.exports;
}
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const model=load('src/lib/community.ts'),media=load('src/lib/media.ts');
const imaging=load('src/lib/community-image.ts',{'sharp':sharp,'@/lib/media':media});
let writes=[],clientCreations=0;
const writer=load('src/lib/supabase/community-media-writer.ts',{'@/lib/community':model,'@/lib/community-image':imaging,'@supabase/supabase-js':{createClient:(url,key,options)=>{
  clientCreations++;assert.equal(url,environment.NEXT_PUBLIC_SUPABASE_URL);assert.equal(key,environment.SUPABASE_COMMUNITY_MEDIA_SECRET_KEY);
  assert.equal(options.auth.persistSession,false);assert.equal(options.auth.autoRefreshToken,false);assert.equal(options.auth.detectSessionInUrl,false);
  return {storage:{from:bucket=>{assert.equal(bucket,'community-media');return {upload:async(path,bytes,opts)=>{assert.equal(path,`${id}/image.webp`);assert.equal(opts.upsert,false);assert.equal(opts.contentType,'image/webp');writes.push(Buffer.from(bytes));return {error:null};}};}}};
}}});
const original=await sharp({create:{width:16,height:16,channels:3,background:'#658776'}}).withExif({IFD0:{Copyright:'fixture'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'37/1 30/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'127/1 0/1 0/1'}}).jpeg().toBuffer();
assert.ok((await sharp(original).metadata()).exif);
let user=true,own=true;
const client={auth:{getUser:async()=>({data:{user:user?{id:'verified-owner'}:null},error:null})},from:table=>{
  assert.equal(table,'community_uploads');
  const chain={insert:payload=>{assert.deepEqual(Object.keys(payload),['owner_id']);assert.equal(payload.owner_id,'verified-owner');return chain;},select:fields=>{assert.equal(fields,'id');return chain;},eq:(field,value)=>{assert.equal(field,'id');assert.equal(value,id);return chain;},single:async()=>({data:{id},error:null}),maybeSingle:async()=>({data:own?{id}:null,error:null})};return chain;
}};
const route=load('src/app/community/media/upload/route.ts',{'@/lib/community':model,'@/lib/media':media,'@/lib/supabase/server':{createClient:async()=>client},'@/lib/supabase/community-media-writer':writer});
function request(file,extras={}){const form=new FormData();form.set('file',file);for(const[k,v]of Object.entries(extras))form.set(k,v);return {url:'http://localhost/community/media/upload',headers:new Headers({origin:'http://localhost','content-length':String(file.size+500)}),formData:async()=>form};}
const file=new File([original],'../../original.jpg',{type:'image/jpeg'});
user=false;assert.equal((await route.POST(request(file))).status,401);assert.equal(writes.length,0);
user=true;own=false;assert.equal((await route.POST(request(file))).status,403);assert.equal(writes.length,0);assert.equal(clientCreations,0);
own=true;
for(const field of ['image_id','id','owner_id','path','bucket'])assert.equal((await route.POST(request(file,{[field]:other}))).status,403);
assert.equal(writes.length,0);
assert.equal((await route.POST(request(new File([Buffer.alloc(2097153)],'big.jpg',{type:'image/jpeg'})))).status,400);
assert.equal((await route.POST(request(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})))).status,400);
assert.equal((await route.POST(request(new File([Buffer.from([255,216,255,0])],'bad.jpg',{type:'image/jpeg'})))).status,400);
assert.equal(writes.length,0);assert.equal(clientCreations,0);
const success=await route.POST(request(file));assert.equal(success.status,201);assert.deepEqual(await success.json(),{image_id:id});assert.equal(writes.length,1);
assert.notDeepEqual(writes[0],original);
const stored=await sharp(writes[0]).metadata();assert.equal(stored.format,'webp');assert.equal(stored.exif,undefined);assert.equal(stored.xmp,undefined);assert.equal(stored.iptc,undefined);assert.equal(stored.icc,undefined);
delete environment.SUPABASE_COMMUNITY_MEDIA_SECRET_KEY;
assert.equal((await route.POST(request(file))).status,503);assert.equal(writes.length,1);
// Read path remains session/RLS-based, not secret-based. Policy-model fixture;
// actual PostgreSQL/Storage role execution is a post-review isolated DB test.
let role='anon',status='pending';
const readClient={storage:{from:bucket=>{assert.equal(bucket,'community-media');return {download:async()=> status==='approved'||role==='owner'||role==='admin'?{data:new Blob([writes[0]]),error:null}:{data:null,error:{message:'hidden'}}};}}};
const delivery=load('src/app/community/media/[id]/route.ts',{'@/lib/community':model,'@/lib/community-image':imaging,'@/lib/supabase/server':{createClient:async()=>readClient}});
for(const scenario of [['anon','pending',404],['anon','rejected',404],['anon','approved',200],['other','pending',404],['other','rejected',404],['owner','pending',200],['admin','pending',200]]){
  [role,status]=scenario;const r=await delivery.GET({}, {params:Promise.resolve({id})});assert.equal(r.status,scenario[2]);assert.equal(r.headers.get('cache-control'),'private, no-store');
  if(r.status===200){const m=await sharp(Buffer.from(await r.arrayBuffer())).metadata();assert.equal(m.format,'webp');assert.equal(m.exif,undefined);}
}
const sql=read('supabase/migrations/20260928000000_community_participation.sql');
assert.match(sql,/community-media','community-media',false,2097152,array\['image\/webp'\]/);
assert.match(sql,/create policy community_media_no_insert[\s\S]*?as restrictive for insert to anon, authenticated\s+with check \(bucket_id <> 'community-media'\)/);
assert.doesNotMatch(sql,/create policy community_media_insert\b/);
assert.match(sql,/u.owner_id = auth.uid\(\)/);assert.match(sql,/p.status = 'approved'/);assert.match(sql,/r.role = 'admin'/);
const source=read('src/lib/supabase/community-media-writer.ts');assert.match(source,/import "server-only"/);assert.doesNotMatch(source,/cookies\(|\.from\("profiles"\)|\.auth\.|console\./);
assert.doesNotMatch(read('src/lib/supabase/server.ts')+read('src/lib/supabase/client.ts'),/SUPABASE_COMMUNITY_MEDIA_SECRET_KEY/);
assert.doesNotMatch(read('src/app/community/media/[id]/route.ts'),/community-media-writer|SECRET_KEY/);
console.log('PASS: server Auth/own namespace, forged destinations denied, anonymous upload, size/type/decode rejection, sanitized-only WebP storage without EXIF/GPS, secret isolation/missing-config fail closed, read-role mock matrix, direct-write deny SQL guards. No remote calls; live RLS execution not performed.');
