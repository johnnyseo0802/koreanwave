// Actual Sharp sanitation + mocked admin Storage, never production uploads.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
function load(path,imports={}){const ctx={exports:{},Buffer,Uint8Array,FormData,File,URL,crypto:{randomUUID},require:n=>imports[n]};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,ctx);return ctx.exports;}
const media=load('src/lib/media.ts'),imaging=load('src/lib/community-image.ts',{'sharp':sharp,'@/lib/media':media});let role='member',writes=[];
const client={storage:{from(bucket){assert.equal(bucket,'site-media');return {upload:async(path,bytes,options)=>{assert.match(path,/^images\/[0-9a-f-]{36}\.webp$/);assert.equal(options.contentType,'image/webp');assert.equal(options.upsert,false);writes.push(bytes);return {error:null};},getPublicUrl:()=>({data:{publicUrl:'https://fixture.invalid/public-image.webp'}})};}}};
const route=load('src/app/admin/media/upload/route.ts',{'next/server':{NextResponse:{json:(data,init)=>({data,...init})}},'@/lib/auth/admin-access':{getAdminAccess:async()=>({status:role,client})},'@/lib/media':media,'@/lib/community-image':imaging});
const original=await sharp({create:{width:12,height:12,channels:3,background:'green'}}).withExif({IFD0:{Copyright:'fixture'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'37/1 30/1 0/1'}}).jpeg().toBuffer();assert.ok((await sharp(original).metadata()).exif);
const file=new File([original],'original.jpg',{type:'image/jpeg'});
function req(file,extra){const form=new FormData();form.set('file',file);if(extra)form.set(extra,'forged');return {url:'http://localhost/admin/media/upload',headers:new Headers({origin:'http://localhost','content-length':String(file.size+500)}),formData:async()=>form};}
for(const r of ['member','unauthenticated']){role=r;assert.equal((await route.POST(req(file))).status,403);}assert.equal(writes.length,0);role='admin';
for(const field of ['bucket','path','id','owner_id'])assert.equal((await route.POST(req(file,field))).status,400);
for(const invalid of [new File([Buffer.alloc(2097153)],'big.jpg',{type:'image/jpeg'}),new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'}),new File([Buffer.from([255,216,255,0])],'broken.jpg',{type:'image/jpeg'})])assert.equal((await route.POST(req(invalid))).status,400);
assert.equal(writes.length,0);assert.equal((await route.POST(req(file))).status,201);assert.equal(writes.length,1);assert.notDeepEqual(writes[0],original);
const output=await sharp(writes[0]).metadata();assert.equal(output.format,'webp');for(const key of ['exif','icc','iptc','xmp'])assert.equal(output[key],undefined);
console.log('PASS: admin-only site-media route, fixed destination, oversize/type/decode rejection, actual re-encoded WebP without metadata/GPS, no original stored. Mock Storage only.');
