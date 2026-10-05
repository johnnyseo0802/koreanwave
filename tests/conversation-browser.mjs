// Real Next/Playwright interaction; ALL reads/writes use this in-process fixture API.
// No env loading, production endpoints, credentials or data. Browser external requests blocked.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`,date='2026-10-05T01:00:00Z';
let role='member',sequence=100,empty=false,outage=false;
const writes=[];
const post={id:id(1),title:'A local conversation fixture',body:'A genuine question for this isolated browser fixture.',type:'discussion',status:'approved',published_at:date,created_at:date,image_id:null,image_alt:null,location_label:null,topic:null,is_featured:false};
const comments=[{id:id(10),post_id:post.id,parent_comment_id:null,body:'Different opinions can be helpful. <script>window.unsafe=true</script>',status:'approved',created_at:date},
 {id:id(11),post_id:post.id,parent_comment_id:id(10),body:'A reply with a very long unbroken word: '+'x'.repeat(400),status:'approved',created_at:date},
 {id:id(12),post_id:post.id,parent_comment_id:null,body:'PRIVATE COMMENT SENTINEL',status:'pending',created_at:date}];
const articles=[{id:id(20),title:'Local guide fixture',section:'local-korea',category:'guides',summary:'A concise guide for browser testing.',body:'## A useful perspective\n\nAn editorial body.',status:'published',published_at:date,image_url:null,source_url:null}];
const rows={community_posts:[post],community_comments:comments,community_helpful:[],community_reports:[],article_discussions:[{article_id:id(20),post_id:id(1)}],editorial_articles:articles,profiles:[],community_prompt:[]};
const ownIds=new Set();
const api=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4062');res.setHeader('Content-Type','application/json');
 let raw='';for await(const b of req)raw+=b;const payload=raw?JSON.parse(raw):{};
 if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:id(99),aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:date}));return;}
 const table=url.pathname.split('/').at(-1);
 const counts=()=>['helpful','like','interesting','agree'].map(kind=>({kind,total:rows.community_helpful.filter(r=>r.reaction_type===kind).length}));
 if(url.pathname.includes('/rpc/')){
  const activity=[{post_id:post.id,comments:2,reactions:rows.community_helpful.length,participants:1,last_activity:date,score:3}];
  const rpc={community_can_help:true,community_helpful_counts:[{post_id:post.id,total:0}],conversation_reaction_counts:counts(),my_conversation_comments:comments.filter(c=>ownIds.has(c.id)),trending_conversations:empty?[]:activity,conversation_activity:activity,my_community_contributions:[]};
  if(outage){res.writeHead(503);res.end('{}');return;}res.end(JSON.stringify(rpc[table]??[]));return;
 }
 rows.profiles=[{id:id(99),role}];
 let data=[...(rows[table]??[])];
 for(const[k,v]of url.searchParams){
  if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));
  if(v==='is.null')data=data.filter(r=>r[k]===null);
  if(v.startsWith('in.('))data=data.filter(r=>v.slice(4,-1).split(',').includes(r[k]));
 }
 if(table==='article_discussions')data=rows.article_discussions.map(r=>({article_id:r.article_id,post_id:r.post_id,post:{id:post.id,title:post.title,status:post.status,type:post.type},article:{status:'published'}}));
 if(req.method==='POST'&&!url.pathname.includes('/rpc/')){
  writes.push({table,method:req.method,payload});
  const item={id:id(sequence++),created_at:date,...payload};
  if(table==='community_comments'){assert.deepEqual(Object.keys(payload).sort(),['body','parent_comment_id','post_id']);item.status='approved';item.published_at=date;ownIds.add(item.id);}
  if(table==='community_posts')item.status='pending';
  if(table==='community_reports')item.status='open';
  rows[table].push(item);data=[item];
 }else if(req.method==='DELETE'){
  writes.push({table,method:req.method});rows[table]=rows[table].filter(r=>!data.includes(r));
 }else if(req.method==='PATCH'){
  writes.push({table,method:req.method,payload});for(const r of data)Object.assign(r,payload);
 }else if(req.method!=='GET'){res.writeHead(405);res.end('{}');return;}
 if(empty&&['community_posts','community_comments'].includes(table))data=[];
 if(req.method!=='GET'&&!String(req.headers.prefer).includes('return=representation')){res.writeHead(204);res.end();return;}
 const order=url.searchParams.get('order');
 if(order)data.sort((a,b)=>{for(const field of order.split(',')){const[k,direction]=field.split('.');const n=String(a[k]??'').localeCompare(String(b[k]??''));if(n)return direction==='desc'?-n:n;}return 0;});
 data=data.slice(0,Number(url.searchParams.get('limit')??1000));
 const fields=url.searchParams.get('select');if(fields&&!fields.includes('('))data=data.map(r=>Object.fromEntries(fields.split(',').filter(k=>k in r).map(k=>[k,r[k]])));
 res.end(JSON.stringify(String(req.headers.accept).includes('vnd.pgrst.object')?(data[0]??null):data));
});
await new Promise(r=>api.listen(4062,'127.0.0.1',r));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','4061'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4062',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only'},stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://localhost:4061/community')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(i===59)throw Error('Local fixture start failed');}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
 const goto=async path=>{await page.goto('http://localhost:4061'+path,{waitUntil:'networkidle'});};
 const thread=()=>page.getByRole('region',{name:'Conversation',exact:true});
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await mkdir('.next/conversation-qa',{recursive:true});
 for(const [width,height]of [[390,844],[390,320],[768,900],[1440,900]]){
  await page.setViewportSize({width,height});await goto('/community/posts/'+post.id);
  await thread().getByRole('heading',{name:'Join the conversation'}).waitFor();await overflow();
  assert.equal(await page.locator('textarea').count(),0);
  const login=thread().getByRole('link',{name:'Log in to add your take or react'});
  await login.click();await page.waitForURL(u=>u.pathname==='/login'&&u.searchParams.get('next')===`/community/posts/${post.id}`);
  await goto('/community/posts/'+post.id);
  assert.doesNotMatch(await page.locator('body').innerText(),/PRIVATE COMMENT SENTINEL|author_id|PRIVATE_NAME/);
  assert.equal(await page.evaluate(()=>window.unsafe),undefined);
  assert.equal(await thread().locator('script').count(),0);
 }
 await goto('/admin/conversations');await page.waitForURL(u=>u.pathname==='/login'&&u.searchParams.get('next')==='/admin/conversations');
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:id(99),aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('fixture').join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:id(99)}})).toString('base64url');
 await context.addCookies([{name:'sb-127-auth-token',value,domain:'localhost',path:'/'}]);
 await goto('/admin/conversations');assert.equal(await page.getByRole('heading',{name:'This page isn’t available.'}).count(),1);
 for(const [width,height]of [[390,844],[390,320],[768,900],[1440,900]]){
  await page.setViewportSize({width,height});await goto('/community/posts/'+post.id);await overflow();
  const composer=thread().getByLabel('Add your take',{exact:true});await composer.fill('x');
  await composer.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.tagName), 'BUTTON');
  await thread().getByRole('button',{name:'Post comment',exact:true}).click();
  await thread().getByText(/Write 2–2,000/).waitFor();
  await composer.fill('A considered local fixture comment '+width+' '+height);
  const before=writes.filter(w=>w.table==='community_comments').length;
  await thread().getByRole('button',{name:'Post comment',exact:true}).dblclick();
  await thread().getByText('Your comment is live.',{exact:true}).waitFor();
  await thread().locator('ol').first().getByText('A considered local fixture comment '+width+' '+height,{exact:true}).waitFor();
  assert.equal(writes.filter(w=>w.table==='community_comments').length,before+1,'Double click inserts once');
  assert.equal(await thread().getByLabel('Add your take',{exact:true}).count(),0,'Success replaces form');
  const like=thread().getByRole('button',{name:/^like ·/i});assert.ok((await like.boundingBox()).height>=44);
  await like.click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='like · 1'&&b.getAttribute('aria-pressed')==='true'));
  await like.click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='like · 0'&&b.getAttribute('aria-pressed')==='false'));
  await thread().locator('summary').filter({hasText:/^Reply$/}).first().click();
  await thread().locator('textarea[name="body"]:visible').fill('A reply from the local browser fixture.');
  await thread().getByRole('button',{name:'Post reply',exact:true}).click();
  await thread().getByText('Your reply is live.',{exact:true}).waitFor();
  await thread().locator('ol ol').getByText('A reply from the local browser fixture.',{exact:true}).first().waitFor();
  await thread().locator('summary').filter({hasText:/^Report comment$/}).first().click();
  await thread().getByLabel('Reason',{exact:true}).first().selectOption('harassment');
  await thread().getByLabel('Details (optional)').first().fill('Review this local fixture only.');
  await thread().getByRole('button',{name:'Send report'}).first().click();await thread().getByText('Report received. Disagreement is welcome; abuse is reviewed.',{exact:true}).waitFor();
  await overflow();await page.screenshot({path:`.next/conversation-qa/thread-${width}-${height}.png`,fullPage:true});
  console.log(`PASS: ${width}x${height} comment/reply/reaction toggle/report actual interactions, keyboard, long text, no overflow`);
 }
 await goto('/articles/'+id(20));await page.getByRole('link',{name:'Add your take →',exact:true}).click();await page.waitForURL('**/community/posts/'+post.id);
 await goto('/community?type=trending');await page.getByRole('heading',{name:'Trending conversations'}).waitFor();
 await page.getByRole('link',{name:'Discussions',exact:true}).click();await page.waitForURL('**/community?type=discussion');
 role='admin';await goto('/admin/conversations?tab=discussions');await page.getByLabel('Title',{exact:true}).fill('An operator-created local fixture');await page.getByLabel('Conversation starter').fill('What would you say about this local fixture?');
 await page.getByRole('button',{name:'Submit prompt for review'}).click();await page.getByText(/Discussion submitted to the existing pending queue/).waitFor();
 await page.locator('select[name=article_id]').selectOption(id(20));await page.locator('select[name=post_id]').selectOption(post.id);
 await page.getByRole('button',{name:'Save connection'}).click();await page.getByText('Discussion linked. Draft articles remain private.',{exact:true}).waitFor();
 await goto('/admin/conversations?tab=pending');const card=page.locator('article').filter({hasText:'PRIVATE COMMENT SENTINEL'});await card.getByRole('button',{name:'Approve comment',exact:true}).click();await page.waitForFunction(()=>!document.body.innerText.includes('PRIVATE COMMENT SENTINEL'));
 await goto('/admin/conversations?tab=approved');const approved=page.locator('article').filter({hasText:'PRIVATE COMMENT SENTINEL'});await approved.getByRole('button',{name:'Hide',exact:true}).click();await page.waitForFunction(()=>!document.body.innerText.includes('PRIVATE COMMENT SENTINEL'));
 const live=page.locator('article').filter({hasText:'A considered local fixture comment 390 844'});
 await live.getByRole('button',{name:'Hide',exact:true}).click();await page.waitForFunction(()=>!document.body.innerText.includes('A considered local fixture comment 390 844'));
 const rootCard=page.locator('article').filter({has:page.getByText('Different opinions can be helpful. <script>window.unsafe=true</script>',{exact:true})}).first();
 await rootCard.getByRole('button',{name:'Hide',exact:true}).click();
 await rootCard.waitFor({state:'detached'});
 await goto('/admin/conversations?tab=reports');await page.getByRole('button',{name:'Mark reviewed'}).first().click();
 await context.clearCookies();await goto('/community/posts/'+post.id);
 await thread().getByText('A considered local fixture comment 390 320',{exact:true}).waitFor();
 assert.doesNotMatch(await thread().innerText(),/PRIVATE COMMENT SENTINEL|A considered local fixture comment 390 844|A reply from the local browser fixture\./);
 empty=true;await goto('/community?type=trending');await page.getByText('No published conversations yet. Your real experiences can start the next one.',{exact:true}).waitFor();
 empty=false;outage=true;await goto('/community?type=trending');await page.getByText('Conversations are temporarily unavailable.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.ok(writes.length>0);
 console.log('PASS: logged-out return CTA/member admin denial, escaped HTML, private markers hidden, article navigation, trending/empty/outage, operator create/approve/hide/report. ALL mutations isolated to the local fixture server.');
 if(process.env.RUN_SITE_BROWSER==='1'){
  empty=false;outage=false;const before=writes.length;
  await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['tests/site-browser.mjs'],{env:{...process.env,QA_BASE_URL:'http://localhost:4061'},stdio:'inherit',windowsHide:true});
   child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('General site browser regression failed')));
  });
  assert.equal(writes.length,before,'General site suite does not mutate fixtures');
 }
}finally{await browser?.close();app.kill();await new Promise(r=>api.close(r));}
