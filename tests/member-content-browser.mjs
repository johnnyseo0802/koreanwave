// Real Next + browser; HTTP fixture is synthetic and isolated, NOT a RLS proof.
// No env files or real credentials. Server AND browser external networking blocked.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const id=n=>`dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12,'0')}`;
const date='2026-10-01T01:00:00Z',edited='2026-10-18T06:45:00Z';
let actor='owner',items=[],writes=0,cleanupFail=false,policyReports=[],restriction=[];
const photo=await sharp({create:{width:120,height:90,channels:3,background:'#d9ff70'}}).webp().toBuffer();
const tables={community_posts:'post',questions:'question',answers:'answer',reviews:'review',community_comments:'comment'};
function reset(){items=['photo','youtube','story','tip','discussion','question','answer','review','comment','reply'].map((type,i)=>({
 id:id(10+i),kind:i<5?'post':i>7?'comment':type,type:i<2?'moment':i<5?type:undefined,title:i<6?'Synthetic owner '+type:null,
 body:'Synthetic original body for a respectful conversation.',commercial_disclosure:'personal',status:'approved',revision:1,created_at:date,published_at:date,edited_at:null,
 image_id:type==='photo'?id(90):null,image_alt:type==='photo'?'Synthetic photo':null,location_label:null,topic:i<5?'culture':null,
 youtube_video_id:type==='youtube'?'abcdefghijk':null,youtube_title:type==='youtube'?'Synthetic video':null,youtube_channel_name:type==='youtube'?'Synthetic channel':null,
 post_id:id(12),question_id:id(15),place_id:id(80),parent_comment_id:type==='reply'?id(18):null,is_featured:false,owner:'owner'
 }));items.push({...items[2],id:id(60),title:'Other member post',owner:'other'});}
reset();
const alive=p=>!p.deleted&&(p.kind!=='comment'||items.some(r=>r.id===p.post_id&&!r.deleted))&&(!p.parent_comment_id||items.some(r=>r.id===p.parent_comment_id&&!r.deleted));
const safe=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='owner'&&k!=='deleted'));
const api=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4082');res.setHeader('Content-Type','application/json');
 let raw='';for await(const b of req)raw+=b;const payload=raw?JSON.parse(raw):{};
 if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:id(actor==='owner'?1:actor==='other'?2:3),role:'authenticated',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:date}));return;}
 if(url.pathname.startsWith('/storage/v1/object/')){res.setHeader('Content-Type','image/webp');res.end(photo);return;}
 const table=url.pathname.split('/').at(-1);
 if(url.pathname.includes('/rpc/')){
  if(table==='my_writing_restriction'){res.end(JSON.stringify(restriction));return;}
  if(table==='report_member_content'){policyReports.push(payload);res.end('null');return;}
  if(table==='member_policy_queue'){
   if(actor!=='admin'){res.writeHead(403);res.end('{}');return;}
   if(payload.view_name==='restrictions'){res.end(JSON.stringify(restriction.map(r=>({id:r.case_id,kind:'restriction',status:r.mode,revision:1}))));return;}
   res.end(JSON.stringify(payload.view_name==='history'?[]:items.filter(p=>alive(p)&&(payload.view_name==='pending'?p.status==='pending':payload.view_name==='hidden'?p.status==='rejected':policyReports.some(r=>r.target===p.id))).map(p=>({...safe(p),review_reason:'declared_commercial',reports:policyReports.filter(r=>r.target===p.id).length}))));return;
  }
  if(table==='clear_member_writing_restriction'){if(actor!=='admin'||payload.expected_version!=='1'){res.writeHead(403);res.end('{}');return;}restriction=[];writes++;res.end('null');return;}
  if(table==='review_member_policy'){
   const p=items.find(p=>p.id===payload.target&&alive(p));if(actor!=='admin'||!p||String(p.revision)!==payload.expected_revision){res.writeHead(409);res.end('{}');return;}
   p.revision++;writes++;if(payload.action==='approve'||payload.action==='restore')p.status='approved';if(payload.action==='hide')p.status='rejected';
   if(payload.action==='warn')restriction=[{mode:'warning',expires_at:null}];
   policyReports=policyReports.filter(r=>r.target!==p.id);res.end('null');return;
  }
  if(table==='my_manageable_content'){res.end(JSON.stringify(items.filter(p=>p.owner===actor&&alive(p)&&(!payload.target||p.id===payload.target)).map(safe)));return;}
  if(table==='manage_member_content'){
   const p=items.find(p=>p.id===payload.target&&p.kind===payload.kind&&p.owner===actor&&alive(p));
   if(!p||String(p.revision)!==String(payload.expected_revision)){res.writeHead(409);res.end('{}');return;}
   assert.ok(['edit','delete'].includes(payload.operation));
   assert.deepEqual(Object.keys(payload).sort(),payload.operation==='edit'?['expected_revision','kind','operation','patch','target']:['expected_revision','kind','operation','target']);
   if(payload.operation==='edit'){
    const changed=Object.entries(payload.patch).some(([k,v])=>(p[k]??null)!==v);
    if(changed){Object.assign(p,payload.patch);p.edited_at=edited;p.revision++;p.status=p.type==='discussion'||p.commercial_disclosure==='commercial'?'pending':'approved';writes++;}
    res.end(JSON.stringify({id:p.id,revision:p.revision,status:p.status,changed}));return;
   }
   p.deleted=true;p.status='rejected';p.revision++;writes++;res.end(JSON.stringify({id:p.id,revision:p.revision,status:'deleted',cleanup_pending:cleanupFail}));return;
  }
  const rpc={community_helpful_counts:[],conversation_reaction_counts:[],my_conversation_comments:items.filter(p=>p.kind==='comment'&&p.owner===actor&&alive(p)).map(safe),trending_conversations:[],conversation_activity:[],member_cleanup_pending:[]};
  res.end(JSON.stringify(rpc[table]??[]));return;
 }
 if(req.method!=='GET'){res.writeHead(405);res.end('{}');return;}
 let data=table==='profiles'?[{id:id(actor==='owner'?1:actor==='other'?2:3),role:actor==='admin'?'admin':'member'}]:table==='places'?[{id:id(80),name:'Synthetic place',area:'Seoul',category:'culture',description:'Synthetic description',visitor_info:null,status:'published',published_at:date,image_url:null}]:items.filter(p=>p.kind===tables[table]&&alive(p)).map(safe);
 for(const[k,v]of url.searchParams){if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));if(v==='is.null')data=data.filter(r=>r[k]===null);if(v.startsWith('in.('))data=data.filter(r=>v.slice(4,-1).split(',').includes(r[k]));}
 const select=url.searchParams.get('select');if(select&&!select.includes('('))data=data.map(r=>Object.fromEntries(select.split(',').filter(k=>k in r).map(k=>[k,r[k]])));
 res.end(JSON.stringify(String(req.headers.accept).includes('vnd.pgrst.object')?(data[0]??null):data));
});
await new Promise(r=>api.listen(4082,'127.0.0.1',r));
const environment=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(SUPABASE|OPENAI|SECRET|TOKEN|PASSWORD|API_KEY|NODE_OPTIONS)/i.test(k)));
const app=spawn(process.execPath,['--require',resolve('tests/member-network-guard.cjs'),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','4081'],{env:{...environment,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4082',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-only'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let startup='';app.stdout.on('data',b=>startup=(startup+b).slice(-4000));app.stderr.on('data',b=>startup=(startup+b).slice(-4000));
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4081/community')).ok)break;}catch{}await new Promise(r=>setTimeout(r,300));if(i===49)throw Error('Local server did not start: '+startup);}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({locale:'en-US',timezoneId:'Asia/Seoul'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.name));page.setDefaultTimeout(10000);
 await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const go=path=>page.goto('http://127.0.0.1:4081'+path,{waitUntil:'networkidle'});
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await go('/account/content/post/'+id(12)+'/edit');assert.equal(new URL(page.url()).pathname,'/login');
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:id(1),aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('fixture').join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:id(1)}})).toString('base64url');
 await context.addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/'}]);
 await mkdir('.next/member-content-qa',{recursive:true});
 for(const width of [390,768,1440]){
  reset();actor='owner';await page.setViewportSize({width,height:900});
  await go('/community/posts/'+id(12));await page.getByLabel('Manage your content',{exact:true}).first().waitFor();await overflow();
  assert.equal(await page.locator('time').filter({hasText:/^Edited/}).count(),0,'No historical false Edited label');
  await go('/account/content/post/'+id(60)+'/edit');await page.getByRole('heading',{name:'This page isn’t available.'}).waitFor();
  for(const p of items.filter(p=>p.owner==='owner')){
   await go(`/account/content/${p.kind}/${p.id}/edit`);await page.getByRole('heading',{name:'Edit your content',exact:true}).waitFor();await overflow();
   assert.equal(await page.locator('textarea[name=body]').inputValue(),p.body);
   if(p.id===id(12)){
    const before=writes;await page.getByRole('button',{name:'Save changes'}).click();await page.waitForURL('**/account/contributions?edited=1');assert.equal(writes,before,'No-op save');assert.equal(p.edited_at,null);
    await go(`/account/content/${p.kind}/${p.id}/edit`);
   }
   await page.locator('textarea[name=body]').fill('A synthetic edited body <script>window.bad=true</script> '+width);
   const beforeSave=writes;
   // Two synchronous submit events avoid a second pointer click racing navigation.
   await page.locator('form').filter({has:page.locator('textarea[name=body]')}).evaluate(form=>{form.requestSubmit();form.requestSubmit();});
   await page.waitForURL('**/account/contributions?edited=1');assert.equal(writes,beforeSave+1,'Duplicate submit guard');
   assert.equal(p.edited_at,edited);assert.equal(p.created_at,date);assert.equal(p.published_at,date);assert.equal(p.revision,2);
   assert.equal(p.status,p.type==='discussion'?'pending':'approved');assert.equal(await page.evaluate(()=>window.bad),undefined);
  }
  await go('/account/contributions');await overflow();
  const shown=await page.locator(`time[datetime="${edited}"]`).allTextContents();
  const expected=await page.evaluate(value=>`Edited ${new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value))} · ${new Intl.DateTimeFormat(undefined,{timeStyle:'short'}).format(new Date(value))}`,edited);
  assert.ok(shown.length>0,'Edited timestamp rendered');assert.ok(shown.every(v=>v===expected),JSON.stringify({shown,expected}));
  await page.screenshot({path:`.next/member-content-qa/contributions-${width}.png`,fullPage:true});
  const card=page.locator('article').filter({hasText:'Synthetic owner story'}).first();await card.getByLabel('Manage your content').click();await card.getByRole('button',{name:'Delete',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  await card.getByRole('button',{name:'Delete',exact:true}).click();await dialog.getByRole('button',{name:'Cancel',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Delete');
  await page.screenshot({path:`.next/member-content-qa/delete-${width}.png`,fullPage:true});
  const before=writes;await dialog.getByRole('button',{name:'Delete',exact:true}).dblclick();await page.waitForURL('**/account/contributions?removed=complete');assert.equal(writes,before+1);
  assert.equal(await page.getByText('Synthetic owner story',{exact:true}).count(),0);await overflow();
  console.log(`PASS ${width}px: ten owner edit forms, no-op, dates, escaped text, other-owner denial, keyboard/dialog and one delete`);
 }
 for(const width of [390,768,1440]){
  reset();actor='owner';policyReports=[];await page.setViewportSize({width,height:900});
  await go('/admin/member-policy');await page.getByRole('heading',{name:'This page isn’t available.'}).waitFor();
  await go('/account/content/post/'+id(12)+'/edit');await page.locator('select[name=commercial_disclosure]').selectOption('commercial');
  await page.getByRole('button',{name:'Save changes'}).click();await page.waitForURL('**/account/contributions?edited=1');assert.equal(items[2].status,'pending');
  await go('/community/posts/'+id(60));await page.getByText('Report policy issue',{exact:true}).first().click();
  await page.getByRole('button',{name:'Send policy report'}).first().click();await page.getByText(/A moderator will review it/).waitFor();assert.equal(items.at(-1).status,'approved');
  actor='admin';await go('/admin/member-policy?tab=pending');const held=page.locator('article').filter({hasText:'Synthetic owner story'});await held.waitFor();await overflow();
  await held.locator('input[type=checkbox]').check();const before=writes;await held.getByRole('button',{name:'Record decision'}).dblclick();await held.waitFor({state:'detached'});assert.equal(writes,before+1);assert.equal(items[2].status,'approved');
  await go('/admin/member-policy?tab=reports');const reported=page.locator('article').filter({hasText:'Other member post'});await reported.locator('select[name=action]').selectOption('hide');await reported.locator('input[type=checkbox]').check();await reported.getByRole('button',{name:'Record decision'}).click();await reported.waitFor({state:'detached'});assert.equal(items.at(-1).status,'rejected');
  await go('/admin/member-policy?tab=hidden');const hidden=page.locator('article').filter({hasText:'Other member post'});await hidden.locator('select[name=action]').selectOption('restore');await hidden.locator('input[type=checkbox]').check();await page.screenshot({path:`.next/member-content-qa/policy-${width}.png`,fullPage:true});await overflow();await hidden.getByRole('button',{name:'Record decision'}).click();await hidden.waitFor({state:'detached'});assert.equal(items.at(-1).status,'approved');
  actor='owner';restriction=[{mode:'warning',expires_at:null,case_id:id(999)}];await go('/account/contributions');await page.getByLabel('Writing status').waitFor();
  actor='admin';await go('/admin/member-policy?tab=restrictions');await page.locator('article input[type=checkbox]').check();await overflow();await page.getByRole('button',{name:'Clear writing restriction',exact:true}).click();await page.getByText('No items in this queue.',{exact:true}).waitFor();assert.equal(restriction.length,0);
  actor='owner';
  console.log(`PASS ${width}px: commercial disclosure, member admin denial, report without auto-hide, approve/hide/re-review, duplicate guard, restriction notice`);
 }
 reset();cleanupFail=true;await go('/account/contributions');const card=page.locator('article').filter({hasText:'Synthetic owner photo'});await card.getByLabel('Manage your content').click();await card.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await page.waitForURL('**/account/contributions?removed=pending-image');await page.getByText(/Image cleanup is still pending/).waitFor();
 actor='admin';await go('/community/posts/'+id(60));assert.equal(await page.getByLabel('Manage your content',{exact:true}).count(),0,'Admin does not own another member post');
 await context.clearCookies();await go('/community/posts/'+id(60));assert.equal(await page.getByLabel('Manage your content',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: anonymous/other/admin owner-menu isolation; explicit image cleanup failure; local synthetic HTTP only.');
}finally{await browser?.close();app.kill();await new Promise(r=>api.close(r));}
