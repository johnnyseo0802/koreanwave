// Built Next app + localhost-only fixture API. No production requests or writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const date='2026-09-30T00:00:00Z';let role='member',writes=0;
const c={id:id(1),slug:'seongsu',title:'Seongsu fixture topic',summary:'Connect culture with places and genuine conversations.',introduction:'A useful local fixture introduction. No actual visits or production content are represented.',status:'published',display_order:0,published_at:date,updated_at:date};
const kinds=['editorial_articles','places','experiences','events','questions','community_posts'];
const keys=['article_id','place_id','experience_id','event_id','question_id','community_post_id'];
const rows={content_clusters:[c,{...c,id:id(2),slug:'hidden',title:'PRIVATE CLUSTER SENTINEL',status:'draft'},{...c,id:id(3),slug:'empty',title:'Empty fixture topic'}],content_cluster_prompts:[{id:id(80),cluster_id:id(1),kind:'moment',prompt:'Share one genuine observation from your visit.',display_order:0}],content_cluster_items:[],profiles:[],reviews:[],answers:[],community_prompt:[]};
for(let i=0;i<kinds.length;i++){
 const row={id:id(10+i),title:`Public ${kinds[i]}`,name:`Public ${kinds[i]}`,summary:'A practical published fixture description.',description:'A practical published fixture description.',body:'A genuine fixture body for a layout check.',area:'Seoul',category:'food',section:'k-trends',status:i<4?'published':'approved',published_at:date,updated_at:date,image_url:null,image_alt:null,visitor_info:'Verify current practical details.',starts_at:'2099-10-10T00:00:00Z',application_deadline:'2099-10-09T00:00:00Z'};
 rows[kinds[i]]=[row,{...row,id:id(30+i),title:'PRIVATE TARGET SENTINEL',name:'PRIVATE TARGET SENTINEL',status:i<4?'draft':'pending'},{...row,id:id(50+i),title:'REJECTED TARGET SENTINEL',name:'REJECTED TARGET SENTINEL',status:i<4?'draft':'rejected'}];
 for(let j=0;j<3;j++)rows.content_cluster_items.push({id:id(100+i*3+j),cluster_id:id(1),[keys[i]]:id(10+i+j*20),display_order:j});
}
// Cluster relationships remain article_id for Local Korea editorial guides,
// never place_id/experience_id. Includes draft/rejected sentinels above.
for (const article of rows.editorial_articles) { article.section='local-korea'; article.category='guides'; }
const api=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4042');res.setHeader('Content-Type','application/json');
 if(req.method!=='GET'){writes++;res.writeHead(405);res.end('{}');return;}
 if(u.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:id(99),aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},email_confirmed_at:date,created_at:date}));return;}
 const table=u.pathname.split('/').at(-1);if(table==='profiles'){res.end(JSON.stringify(String(req.headers.accept).includes('vnd.pgrst.object')?{role}:[{role}]));return;}
 const select=u.searchParams.get('select')??'';let data=[...(rows[table]??[])];
 // Broad visibility intentionally includes private records: explicit app filters
 // must protect public results even when the fixture session is an administrator.
 if(table==='content_cluster_items'&&select.includes('target:')){
  const t=select.match(/target:(\w+)!inner/)[1],key=keys[kinds.indexOf(t)];data=data.filter(r=>r[key]).map(r=>({...r,target:rows[t].find(x=>x.id===r[key])}));
 }
 if(table==='content_cluster_items'&&select.includes('cluster:'))data=data.map(r=>({...r,cluster:rows.content_clusters.find(c=>c.id===r.cluster_id)}));
 for(const [key,value]of u.searchParams){if(value.startsWith('eq.'))data=data.filter(r=>String(key.includes('.')?r[key.split('.')[0]]?.[key.split('.')[1]]:r[key])===value.slice(3));if(value.startsWith('gt.'))data=data.filter(r=>String(r[key])>value.slice(3));}
 if(u.searchParams.has('or')){const terms=u.searchParams.get('or').slice(1,-1).split(',').map(v=>v.split('.ilike.%'));data=data.filter(r=>terms.some(([field,term])=>String(r[field]??'').toLowerCase().includes((term??'').replace(/%$/,'').toLowerCase())));}
 data=data.slice(0,Number(u.searchParams.get('limit')??100));
 if(select&&!select.includes(':'))data=data.map(r=>Object.fromEntries(select.split(',').filter(k=>k in r).map(k=>[k,r[k]])));
 const single=String(req.headers.accept).includes('vnd.pgrst.object');res.end(JSON.stringify(single?data[0]??null:data));
});
await new Promise(r=>api.listen(4042,'127.0.0.1',r));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','4041'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4042',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only'},stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let n=0;n<60;n++){try{if((await fetch('http://localhost:4041/explore')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(n===59)throw Error('Fixture server did not start');}
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext();
 await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='localhost'&&['GET','HEAD'].includes(route.request().method())?route.continue():route.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',()=>errors.push('Runtime error'));await mkdir('.next/clusters-qa',{recursive:true});
 async function check(path,width,admin=false){await page.goto('http://localhost:4041'+path,{waitUntil:'load'});await page.locator('h1').first().waitFor();if(path==='/explore/seongsu'||path.endsWith('/preview'))await page.getByRole('heading',{name:'Make it your Korea'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${path} overflow ${width}`);if(!admin)assert.doesNotMatch(await page.locator('body').innerText(),/PRIVATE (TARGET|CLUSTER) SENTINEL|REJECTED TARGET SENTINEL/);}
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});for(const path of ['/explore','/explore/seongsu','/founding-members','/search?q=Seongsu',`/articles/${id(10)}`,`/local-korea/places/${id(11)}`,`/local-korea/experiences/${id(12)}`])await check(path,width);await page.goto('http://localhost:4041/explore/seongsu',{waitUntil:'load'});await page.getByRole('heading',{name:'Make it your Korea'}).waitFor();await page.screenshot({path:`.next/clusters-qa/public-${width}.png`,fullPage:true});console.log(`PASS: ${width}px topic/list/search/related/founding layouts, no private targets or overflow`);}
 for(const slug of ['hidden','missing','INVALID']){await check('/explore/'+slug,375);assert.equal(await page.getByRole('heading',{name:'This page isn’t available.'}).count(),1);}
 await check('/explore/empty',375);assert.equal(await page.getByRole('heading',{name:'Places',exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'Make it your Korea'}).count(),0);
 for(const path of ['/admin/clusters','/admin/clusters/new','/admin/local-content/places/new']){await page.goto('http://localhost:4041'+path,{waitUntil:'load'});await page.waitForURL(u=>u.pathname==='/login');}
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:id(99),aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('fixture').join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:id(99)}})).toString('base64url');await context.addCookies([{name:'sb-127-auth-token',value,domain:'localhost',path:'/'}]);
 await check('/admin/clusters',375);assert.equal(await page.getByRole('heading',{name:'This page isn’t available.'}).count(),1);role='admin';
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});for(const path of ['/admin/clusters','/admin/clusters/new',`/admin/clusters/${id(1)}`,`/admin/clusters/${id(1)}/preview`,'/admin/local-content/places/new','/admin/local-content/experiences/new'])await check(path,width,true);await check(`/admin/clusters/${id(1)}/preview`,width);await page.screenshot({path:`.next/clusters-qa/admin-preview-${width}.png`,fullPage:true});await check('/explore/seongsu',width);console.log(`PASS: ${width}px admin list/editor/preview/local-create and admin public draft privacy`);}
 assert.equal(writes,0);assert.deepEqual(errors,[]);console.log('PASS: anonymous redirect, member denial, private/missing 404, empty sections omitted. No writes or production requests.');
}finally{await browser?.close();app.kill();await new Promise(r=>api.close(r));}
