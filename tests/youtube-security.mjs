// Isolated execution only: no network, credentials or database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, imports={}) { const ctx={exports:{},URL,Buffer,AbortSignal,FormData,require:n=>imports[n]??{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports; }
const yt=load('src/lib/youtube.ts');const id='dQw4w9WgXcQ';
for(const url of [`https://youtube.com/watch?v=${id}`,`https://youtu.be/${id}?si=abc`,`https://www.youtube.com/shorts/${id}`]) assert.equal(yt.parseYouTube(url),id);
for(const url of ['javascript:alert(1)',`https://youtube.com.evil.org/watch?v=${id}`,`https://user@youtube.com/watch?v=${id}`,`https://youtube.com/watch?v=${id}&v=${id}`,`http://youtu.be/${id}`,'<iframe>','https://youtu.be/short','https://localhost/watch?v='+id])assert.equal(yt.parseYouTube(url),null);
const model=load('src/lib/community.ts');const base={type:'moment',title:'',body:'My own opinion',topic:'',image_id:'',image_alt:'',location_label:'',youtube_video_id:id};
assert.equal(model.validatePost(base),null);
for(const p of [{youtube_video_id:''},{type:'story'},{image_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},{youtube_video_id:'<script>'},{body:'x'.repeat(501)}])assert.ok(model.validatePost({...base,...p}));
const sql=fs.readFileSync('supabase/migrations/20261016000000_community_youtube_moments.sql','utf8');
assert.match(sql,/begin;/);assert.match(sql,/commit;/);assert.match(sql,/grant insert\(youtube_video_id,youtube_title,youtube_channel_name\)/);
assert.doesNotMatch(sql,/create policy|security definer|grant update|grant all|update public\./i);
const render=fs.readFileSync('src/components/youtube-video.tsx','utf8');assert.match(render,/youtube-nocookie\.com\/embed/);assert.match(render,/autoplay=0/);assert.doesNotMatch(render,/dangerouslySetInnerHTML/);assert.match(render,/aspect-video/);
const actions=fs.readFileSync('src/app/community/actions.ts','utf8');assert.match(actions,/auth\.getUser/);assert.match(actions,/await youtubeMetadata/);
let authenticated=false, metadataCalls=0, inserted=null, unavailable=false;
const action=load('src/app/community/actions.ts',{
  '@/lib/community':model,
  '@/lib/youtube-metadata':{youtubeMetadata:async()=>{metadataCalls++;return unavailable?null:{id,title:'Safe title',channel:'Channel'};}},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'verified-user'}:null},error:null})},from:()=>({insert:async value=>{inserted=value;return {error:null};}})})},
  'next/cache':{revalidatePath(){}},
});
const form=new FormData();for(const [k,v]of Object.entries({...base,author_id:'forged',status:'approved',published_at:'forged',youtube_title:'forged'}))form.set(k,v);
assert.equal((await action.submitCommunityPost(form)).ok,false);assert.equal(metadataCalls,0);
authenticated=true;assert.equal((await action.submitCommunityPost(form)).ok,true);
assert.equal(inserted.author_id,'verified-user');assert.equal(inserted.youtube_title,'Safe title');assert.equal(inserted.youtube_channel_name,'Channel');assert.equal(inserted.image_id,null);
for(const key of ['status','published_at','created_at','is_featured'])assert.ok(!(key in inserted));
unavailable=true;inserted=null;assert.equal((await action.submitCommunityPost(form)).ok,false);assert.equal(inserted,null);
console.log('PASS: YouTube URLs/media validation, anonymous denial, authoritative metadata/identity, safe INSERT whitelist, unavailable-video fail closed, SQL grants and responsive escaped rendering. No remote calls.');
