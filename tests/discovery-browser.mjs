// Production build + localhost-only mocked Supabase. Never uses .env credentials.
// No real user, login, upload, DB write or SQL execution. Requires pnpm build first.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const uuid = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
function pngChunk(type, data) {
 const name=Buffer.from(type), input=Buffer.concat([name,data]);let crc=0xffffffff;
 for(const b of input){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 const length=Buffer.alloc(4), checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);
 return Buffer.concat([length,input,checksum]);
}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(16,0);ihdr.writeUInt32BE(9,4);ihdr[8]=8;ihdr[9]=2;
const pixels=Buffer.alloc(9*(1+16*3),160);for(let y=0;y<9;y++)pixels[y*49]=0;
const fixturePng=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(pixels)),pngChunk('IEND',Buffer.alloc(0))]);
const date='2026-09-27T00:00:00Z';
const common={status:'published',published_at:date,updated_at:date,image_url:null,image_alt:null};
const rows={
 editorial_articles: ['music','dramas','movies','beauty','fashion','food'].map((category,i)=>({...common,id:uuid(i+1),section:i<3?'k-contents':'k-trends',category,title:`Fixture ${category} story`,summary:'A useful published editorial discovery for a visitor.',body:'An original fixture body for layout verification.\n\nA second paragraph to verify readable plain text.',source_url:null})),
 places:Array.from({length:6},(_,i)=>({...common,id:uuid(i+11),name:`Fixture place ${i+1}`,area:i<3?'Seongsu':'Seochon',category:'Neighborhood',description:'A useful public place description for exploring Korea.',visitor_info:'Public visitor guidance only.'})),
 experiences:Array.from({length:4},(_,i)=>({...common,id:uuid(i+21),name:`Fixture experience ${i+1}`,area:'Seoul',category:i<2?'Culture':'Walking',description:'A useful public experience description for exploring Korea.',visitor_info:'Ask the operator for current availability.'})),
 events:[{...common,id:uuid(31),title:'Fixture public gathering',public_area:'Seoul',category:'Social walk',starts_at:'2099-10-10T15:00:00+09:00',application_deadline:'2099-10-09T15:00:00+09:00',description:'Public gathering description without precise private location.',participation_info:'Wear comfortable shoes.',cancellation_policy:'Check the organizer guidance.'}],
 questions:[{id:uuid(41),title:'Fixture approved question',body:'How can I plan a considerate visit?',status:'approved',published_at:date}],
 reviews:[],answers:[],event_applications:[],profiles:[{id:uuid(99),role:'admin'}],
};
rows.editorial_articles.push({...rows.editorial_articles[0],id:uuid(98),title:'PRIVATE DRAFT SENTINEL',status:'draft'});
rows.editorial_articles.push({...rows.editorial_articles[0],id:uuid(7),section:'local-korea',category:'guides',title:'Fixture local guide'});
rows.editorial_articles.push({...rows.editorial_articles[0],id:uuid(97),section:'local-korea',category:'guides',title:'PRIVATE DRAFT SENTINEL',status:'draft'});
// Read only the built public image allowlist (never env/key values). Image requests
// are fulfilled in the browser with a tiny local PNG; no remote image is fetched.
const host=JSON.parse(readFileSync('.next/required-server-files.json','utf8')).config.images.remotePatterns[0]?.hostname;
assert.ok(host,'Build must have the project image allowlist configured');
for(const table of ['editorial_articles','places','experiences','events']) for(const row of rows[table]) {
 row.image_url=`https://${host}/storage/v1/object/public/site-media/images/${row.id}.png`;
 row.image_alt='Local image fixture for responsive testing';
}
let mutations=0,privateReads=0;
const api=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4032');
 res.setHeader('content-type','application/json');
 if(req.method!=='GET'){mutations++;res.writeHead(405);res.end('{}');return;}
 if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:uuid(99),aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},email_confirmed_at:date,created_at:date}));return;}
 const table=url.pathname.split('/').at(-1);
 if(table==='event_meeting_details'){privateReads++;res.writeHead(403);res.end('{}');return;}
 let data=[...(rows[table]??[])];
 for(const [key,value] of url.searchParams){
  if(value.startsWith('eq.'))data=data.filter(row=>String(row[key])===value.slice(3));
  if(value.startsWith('gt.'))data=data.filter(row=>String(row[key])>value.slice(3));
 }
 if(url.searchParams.has('or')){
  const terms=url.searchParams.get('or').slice(1,-1).split(',').map(v=>v.split('.ilike.%'));
  data=data.filter(row=>terms.some(([field,term])=>String(row[field]??'').toLowerCase().includes((term??'').replace(/%$/,'').toLowerCase())));
 }
 data=data.slice(0,Number(url.searchParams.get('limit')??100));
 const fields=url.searchParams.get('select')?.split(',');
 if(fields)data=data.map(row=>Object.fromEntries(fields.filter(k=>k in row).map(k=>[k,row[k]])));
 const single=String(req.headers.accept).includes('vnd.pgrst.object');
 res.end(JSON.stringify(single?(data[0]??null):data));
});
await new Promise(resolve=>api.listen(4032,'127.0.0.1',resolve));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','4031'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4032',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-fixture-only'},stdio:'ignore',windowsHide:true});
const base='http://localhost:4031';
let browser;
try {
 for(let i=0;i<60;i++){try{const r=await fetch(base);if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(i===59)throw new Error('Local fixture app did not start');}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext();
 await context.route('**/*',route=>{const r=route.request();const u=new URL(r.url());
  if(u.hostname==='localhost' && u.pathname==='/_next/image') return route.fulfill({status:200,contentType:'image/png',body:fixturePng});
  return u.hostname==='localhost'&&['GET','HEAD'].includes(r.method())?route.continue():route.abort();});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',()=>errors.push('Browser runtime error'));
 await mkdir('.next/discovery-qa',{recursive:true});
 const paths=['/','/search','/search?q=Fixture','/search?q=unmatched','/k-contents','/k-contents/music','/k-contents/dramas','/k-contents/movies','/k-trends','/k-trends/beauty','/k-trends/fashion','/k-trends/food','/local-korea/places','/local-korea/places?area=Seongsu','/local-korea/experiences?category=Culture',`/articles/${uuid(1)}`,`/local-korea/places/${uuid(11)}`,`/local-korea/experiences/${uuid(21)}`,'/events',`/event/${uuid(31)}`];
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+'/local-korea',{waitUntil:'networkidle'});
  await page.getByRole('link',{name:/Guides.*Read editorial/}).click();
  await page.waitForURL('**/local-korea/guides');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.getByRole('link',{name:/Fixture local guide/}).click();
  await page.waitForURL(`**/articles/${uuid(7)}`);
  await page.getByText('Local Korea / guides',{exact:true}).waitFor();
  await page.getByRole('link',{name:/Back to guides/}).click();
  await page.waitForURL('**/local-korea/guides');
  assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE DRAFT SENTINEL'));
  await page.goto(base+'/search?q=guides',{waitUntil:'networkidle'});
  assert.ok(await page.getByRole('link',{name:/Fixture local guide/}).count());
  for(const path of paths){
   const response=await page.goto(base+path,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,path);assert.equal(await page.locator('h1').count(),1,path);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} ${path} overflow`);
   assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE DRAFT SENTINEL'),path);
   if(path==='/search?q=Fixture')assert.ok(await page.getByText('Fixture music story',{exact:true}).count());
   if(path===`/articles/${uuid(1)}`){
    const img=page.locator('article img');await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const el=document.querySelector('article img');return el?.complete && el.naturalWidth>0;},{},{timeout:10000}).catch(async()=>{
      const state=await page.locator('article').evaluate(el=>{const img=el.querySelector('img');return {imageExists:!!img,naturalWidth:img?.naturalWidth,complete:img?.complete,optimized:img?.currentSrc.includes('/_next/image'),fallback:el.innerText.includes('Korean Wave / Discover')};});
      throw new Error('Fixture image state: '+JSON.stringify(state));
    });
    const imageState=await img.evaluate(el=>({width:el.naturalWidth,fit:getComputedStyle(el).objectFit}));
    assert.ok(imageState.width>0, 'Image decoded');assert.equal(imageState.fit,'cover');
    const box=await img.boundingBox();assert.ok(Math.abs(box.width/box.height-16/9)<0.02);
    assert.ok((await page.locator('link[rel="canonical"]').getAttribute('href')).endsWith(path));
    assert.ok((await page.locator('meta[property="og:image"]').first().getAttribute('content')).includes('/site-media/'));
   }
   if(path==='/local-korea/places?area=Seongsu')assert.equal(await page.getByRole('link',{name:/Fixture place/}).count(),3);
   if(path==='/local-korea/experiences?category=Culture')assert.equal(await page.getByRole('link',{name:/Fixture experience/}).count(),2);
   if(path==='/')await page.screenshot({path:`.next/discovery-qa/home-${width}.png`,fullPage:true});
  }
  console.log(`PASS: ${width}px, ${paths.length} populated public routes, search/filters, no draft exposure or overflow`);
 }
 for(const id of [uuid(98),uuid(97)]){await page.goto(base+`/articles/${id}`,{waitUntil:'networkidle'});assert.equal(await page.getByRole('heading',{name:'This page isn’t available.'}).count(),1);assert.ok(!(await page.content()).includes('PRIVATE DRAFT SENTINEL'));}
 // Failed image delivery must remove the image element, not show a broken icon.
 rows.editorial_articles[0].image_url=`https://${host}/storage/v1/object/public/site-media/images/${uuid(96)}.png`;
 await page.route('**/_next/image*',route=>route.abort());
 await page.goto(base+`/articles/${uuid(1)}`,{waitUntil:'networkidle'});
 await page.locator('article').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>!document.querySelector('article img') && document.querySelector('article')?.innerText.toLowerCase().includes('korean wave / discover'),{},{timeout:10000});
 await page.unroute('**/_next/image*');
 for(const path of ['/admin/local-content','/admin/events','/admin/content/new']){await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,'/login');}
 // Local-only signed-session fixture; fake Auth endpoint verifies it, not production.
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:uuid(99),aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('fixture-signature').join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:uuid(99)}})).toString('base64url');
 await context.addCookies([{name:'sb-127-auth-token',value,domain:'localhost',path:'/'}]);
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const path of ['/admin/content/new',`/admin/local-content/places/${uuid(11)}`,`/admin/events/${uuid(31)}`]){
   await page.goto(base+path,{waitUntil:'networkidle'});
   assert.equal(new URL(page.url()).pathname,path);
   assert.equal(await page.getByLabel('Upload cover image').count(),1);
   if(path==='/admin/content/new'){
    await page.locator('select[name="section"]').selectOption('local-korea');
    assert.equal(await page.locator('select[name="category"]').inputValue(),'guides');
    assert.equal(await page.locator('select[name="category"] option').count(),1);
    await page.locator('select[name="section"]').selectOption('k-trends');
    assert.equal(await page.locator('select[name="category"]').inputValue(),'beauty');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} admin overflow`);
  }
  await page.screenshot({path:`.next/discovery-qa/admin-${width}.png`,fullPage:true});
  await page.goto(base+`/admin/content/${uuid(97)}/preview`,{waitUntil:'networkidle'});
  assert.ok((await page.locator('body').innerText()).includes('PRIVATE DRAFT SENTINEL'));
 }
 assert.equal(mutations,0);assert.equal(privateReads,0);assert.deepEqual(errors,[]);
 console.log('PASS: admin protection + fixture admin form/upload layout, no real accounts, no form submissions, no writes or private meeting reads.');
} finally {await browser?.close();app.kill();await new Promise(resolve=>api.close(resolve));}
