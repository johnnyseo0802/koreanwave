// Existing built Next candidate; loopback-only anonymous browser, no real DB.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {verifyPublicApplication} from '../scripts/member-deployment/release-gate.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(SUPABASE|SECRET|TOKEN|PASSWORD|API_KEY|NODE_OPTIONS|^PG)/i.test(k)));
Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4082',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-only',NEXT_TELEMETRY_DISABLED:'1'});
let writes=0,readRpcs=0,app,browser;const statuses=[];
const api=http.createServer((req,res)=>{
 // Homepage read-only RPC uses POST transport; it is not a content mutation.
 if(req.method==='POST'&&req.url==='/rest/v1/rpc/trending_conversations')readRpcs++;
 else if(req.method!=='GET'){writes++;res.writeHead(405);res.end();return;}
 res.setHeader('content-type','application/json');res.end('[]');
});
try{
 await new Promise((yes,no)=>{api.once('error',no);api.listen(4082,'127.0.0.1',yes);});
 app=spawn(process.execPath,['--require',resolve('tests/member-network-guard.cjs'),resolve('node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','4081'],{env,windowsHide:true,stdio:'ignore'});
 let ready=false;
 for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:4081/login',{signal:AbortSignal.timeout(1000)});if(r.status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.ok(ready,'local candidate ready');
 await verifyPublicApplication(async(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,'https://kgroov.com');
  const r=await fetch('http://127.0.0.1:4081'+u.pathname,options);
  if(u.pathname.startsWith('/admin/')) {assert.equal(r.status,200);statuses.push({path:u.pathname,status:r.status});}
  return r;
 });
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [390,1440]) for(const path of ['/admin/community','/admin/member-policy']) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  assert.equal((await context.cookies()).length,0);
  await context.route('**/*',route=>{
   const r=route.request(),u=new URL(r.url());
   if(r.method()!=='GET'){writes++;return route.abort();}
   return u.hostname==='127.0.0.1'&&['4081','4082'].includes(u.port)?route.continue():route.abort();
  });
  const page=await context.newPage();await page.goto('http://127.0.0.1:4081'+path,{waitUntil:'domcontentloaded',timeout:10000});
  await page.waitForURL(u=>u.origin==='http://127.0.0.1:4081'&&u.pathname==='/login'&&u.searchParams.get('next')==='/admin/community',{timeout:10000});
  await page.locator('input[type="password"]').waitFor({state:'visible'});
  assert.equal(await page.getByRole('heading',{name:'Community moderation',exact:true}).count(),0);
  assert.equal(await page.getByRole('heading',{name:'Member policy review',exact:true}).count(),0);
  assert.equal(await page.locator('[aria-label="Community moderation filters"],[aria-label="Policy queues"]').count(),0);
  await context.close();
 }
 assert.equal(writes,0);
 console.log(JSON.stringify({result:'PASS',http:statuses,browser_cases:4,widths:[390,1440],anonymous:true,mutations:writes,synthetic_read_rpcs:readRpcs,production_connections:0}));
}finally{if(browser)await browser.close();if(app){const closed=new Promise(r=>app.once('exit',r));app.kill();await closed;}await new Promise(r=>api.close(r));}
