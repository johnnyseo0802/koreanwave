// Local fixtures only. Overrides server Supabase URL/key; blocks external browser requests.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const date='2026-09-28T00:00:00Z';
let role='member',writes=0;
const posts=['moment','story','tip'].map((type,i)=>({id:id(i+1),type,title:type==='moment'?null:`A thoughtful Korea ${type}`,body:'An honest experience from a walk around a Seoul neighborhood.\nA useful note for your next visit.',status:'approved',published_at:date,created_at:date,image_id:id(20+i),image_alt:'A quiet green neighborhood',location_label:'Seoul',topic:'culture',is_featured:i===0}));
posts.push({...posts[0],id:id(90),image_id:null,body:'PRIVATE PENDING SENTINEL',status:'pending',published_at:null,is_featured:false});
posts.push({...posts[1],id:id(91),image_id:null,body:'PRIVATE REJECTED SENTINEL',status:'rejected',published_at:null,is_featured:false});
const photo=await sharp({create:{width:400,height:300,channels:3,background:'#739b82'}}).webp().toBuffer();
const api=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4036');
  res.setHeader('content-type','application/json');
  if(url.pathname.startsWith('/storage/v1/object/')){res.setHeader('content-type','image/webp');res.end(photo);return;}
  const table=url.pathname.split('/').at(-1);
  if(url.pathname.includes('/rpc/')){
    if(table==='community_helpful_counts'){res.end(JSON.stringify([{post_id:id(1),total:3}]));return;}
    if(table==='my_community_contributions'){res.end(JSON.stringify(posts.slice(0,3).map(p=>({...p,kind:p.type,target_id:p.id}))));return;}
    res.writeHead(403);res.end('{}');return;
  }
  if(req.method!=='GET'){writes++;res.writeHead(405);res.end('{}');return;}
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:id(99),aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:date}));return;}
  const rows={community_posts:posts,profiles:[{id:id(99),role}],community_prompt:[{id:true,prompt:'What surprised you on your first day in Korea?',suggested_type:'story'}],community_reports:[{id:id(50),post_id:id(1),reason:'spam',details:'Please review this contribution.',status:'open',created_at:date}],community_helpful:[],questions:[{id:id(30),title:'What should I bring for a local walk?',body:'How do I prepare for a relaxed neighborhood walk?',status:'approved',published_at:date}],reviews:[{id:id(31),place_id:id(32),body:'A considerate and enjoyable visit.',status:'approved',published_at:date,'places.status':'published'}]};
  let data=[...(rows[table]??[])];
  for(const[k,v]of url.searchParams)if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));
  data=data.slice(0,Number(url.searchParams.get('limit')??100));
  const fields=url.searchParams.get('select')?.split(',');if(fields)data=data.map(r=>Object.fromEntries(fields.filter(k=>k in r).map(k=>[k,r[k]])));
  res.end(JSON.stringify(String(req.headers.accept).includes('vnd.pgrst.object')?(data[0]??null):data));
});
await new Promise(r=>api.listen(4036,'127.0.0.1',r));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','4035'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4036',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-fixture-only'},stdio:'ignore',windowsHide:true});
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch('http://localhost:4035/community')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(i===59)throw new Error('Fixture server unavailable');}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext();
  await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='localhost'&&['GET','HEAD'].includes(route.request().method())?route.continue():route.abort();});
  const page=await context.newPage();const errors=[];page.on('pageerror',()=>errors.push('Runtime error'));
  await mkdir('.next/community-qa',{recursive:true});
  async function check(path,width,privateAllowed=false){
    await page.goto('http://localhost:4035'+path,{waitUntil:'load'});
    await page.locator('h1').first().waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width} ${path} overflow`);
    if(!privateAllowed)assert.doesNotMatch(await page.locator('body').innerText(),/PRIVATE (PENDING|REJECTED) SENTINEL/);
  }
  for(const width of [375,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/community',...['moment','story','tip','questions','reviews'].map(t=>'/community?type='+t),`/community/posts/${id(1)}`,`/community/posts/${id(2)}`,`/community/posts/${id(3)}`])await check(path,width);
    await page.screenshot({path:`.next/community-qa/public-${width}.png`,fullPage:true});
  }
  for(const value of [id(90),id(91),id(92),'invalid']){await check('/community/posts/'+value,375);assert.equal(await page.getByRole('heading',{name:'This page isn’t available.'}).count(),1);}
  for(const path of ['/write/moment','/account/contributions','/admin/community']){await page.goto('http://localhost:4035'+path,{waitUntil:'load'});await page.waitForURL(u=>u.pathname==='/login');}
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:id(99),aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('fixture').join('.');
  const value='base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:id(99)}})).toString('base64url');
  await context.addCookies([{name:'sb-127-auth-token',value,domain:'localhost',path:'/'}]);
  await check('/admin/community',1440);assert.equal(await page.getByRole('heading',{name:'This page isn’t available.'}).count(),1);
  for(const width of [375,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/write','/write/moment','/write/story?prompt=weekly','/write/tip','/account/contributions',`/community/posts/${id(1)}`])await check(path,width);
    await page.getByText('Report this post',{exact:true}).click();assert.equal(await page.getByLabel('Reason').count(),1);
    await page.goto('http://localhost:4035/write/moment',{waitUntil:'load'});
    await page.locator('input[type=file]').setInputFiles({name:'fixture.webp',mimeType:'image/webp',buffer:photo});
    await page.getByAltText('Your selected photo preview').waitFor();
    await page.getByLabel('Caption',{exact:true}).fill('A small discovery in Seoul.');
    await page.screenshot({path:`.next/community-qa/form-${width}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    role='admin';
    for(const tab of ['pending','approved','rejected','featured','reports','prompt'])await check('/admin/community?tab='+tab,width,true);
    await page.screenshot({path:`.next/community-qa/admin-${width}.png`,fullPage:true});role='member';
    console.log(`PASS: ${width}px public/feed/detail, member share/photo-preview/account/report and admin six tabs; no overflow`);
  }
  assert.equal(writes,0);assert.deepEqual(errors,[]);
  console.log('PASS: private/missing detail uniform not-found; anonymous protection; member admin denial. Local fixtures only, no submissions or production data.');
}finally{await browser?.close();app.kill();await new Promise(r=>api.close(r));}
