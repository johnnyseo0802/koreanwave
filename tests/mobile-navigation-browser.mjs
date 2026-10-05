// Real clicks/taps against local Next + read-only fixture API. No production Auth.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
// Only the public URL's storage-key namespace is needed to align the browser's
// build-time client with the local SSR fixture. Never log env values or use keys.
const require=createRequire(import.meta.url);
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const browserStorageKey=process.env.NEXT_PUBLIC_SUPABASE_URL?`sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`:'sb-127-auth-token';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let writes=0;
const api=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.method==='POST'&&req.url==='/rest/v1/rpc/trending_conversations'){res.end('[]');return;}if(req.method!=='GET'){writes++;res.writeHead(405);res.end('{}');return;}if(req.url.startsWith('/auth/v1/user')){res.end(JSON.stringify({id,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}res.end(req.headers.accept?.includes('vnd.pgrst.object')?'null':'[]');});
await new Promise(r=>api.listen(4052,'127.0.0.1',r));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','4051'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4052',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only'},stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let n=0;n<60;n++){try{if((await fetch('http://localhost:4051')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(n===59)throw Error('Local server unavailable');}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='localhost'&&['GET','HEAD'].includes(route.request().method())?route.continue():route.abort();});
 const page=await context.newPage();const errors=[];page.on('pageerror',()=>errors.push('Browser runtime error'));
 const summary=page.getByLabel('Main menu',{exact:true}),menu=page.getByRole('navigation',{name:'Mobile navigation'});
 const open=async()=>{await summary.tap();await menu.waitFor({state:'visible'});};
 const closed=async()=>{await page.waitForFunction(()=>!document.querySelector('header details')?.open);};
 await page.goto('http://localhost:4051',{waitUntil:'networkidle'});
 // Native touch focus can disappear without a relatedTarget. Losing focus alone
 // must not remove the panel before a real link activation. No synthetic click.
 await open();await summary.evaluate(el=>el.blur());
 assert.equal(await menu.isVisible(),true,'null-relatedTarget focus loss must not hide a still-active menu');
 await menu.getByRole('link',{name:'K-Contents',exact:true}).tap();await page.waitForURL('**/k-contents');await closed();
 for(const [label,path]of [['Local Korea','/local-korea'],['K-Trends','/k-trends'],['Community','/community'],['Events','/events'],['Search','/search'],['Log in','/login'],['Join free','/signup']]){
  await open();const link=menu.getByRole('link',{name:label,exact:true});
  assert.ok((await link.boundingBox()).height>=44,'Minimum 44px touch target');
  assert.equal(await link.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Link owns hit target');
  await link.tap();await page.waitForURL(u=>u.pathname===path);await closed();
 }
 await open();await menu.getByRole('link',{name:'Share',exact:true}).tap();await page.waitForURL(u=>u.pathname==='/login'&&u.searchParams.get('next')==='/write');await closed();
 await open();await page.touchscreen.tap(10,400);await closed();
 await open();await summary.tap();await closed();
 await open();await page.locator('header > a').focus();await closed();
 await open();await page.keyboard.press('Escape');await closed();assert.equal(await summary.evaluate(el=>el===document.activeElement),true);
 await summary.press('Enter');await menu.waitFor({state:'visible'});await page.keyboard.press('Tab');
 assert.equal(await menu.getByRole('link',{name:'K-Contents',exact:true}).evaluate(el=>el===document.activeElement&&getComputedStyle(el).outlineStyle!=='none'),true);
 await page.keyboard.press('Enter');await page.waitForURL('**/k-contents');await closed();
 await page.setViewportSize({width:390,height:320});await open();
 const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y+box.height<=320);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await menu.evaluate(el=>el.scrollHeight>el.clientHeight),true);
 // Native details visibility changes before its queued toggle listener locks
 // scrolling. Wait for the observable lock, not an arbitrary delay.
 await page.waitForFunction(()=>getComputedStyle(document.body).overflow==='hidden',undefined,{timeout:5000});
 await page.mouse.move(5,200);const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,400);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>scrollY),before);
 await menu.getByRole('link',{name:'Join free',exact:true}).tap();await page.waitForURL('**/signup');await closed();
 assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
 await page.setViewportSize({width:1440,height:900});assert.equal(await summary.isVisible(),false);
 await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Community',exact:true}).click();await page.waitForURL('**/community');
 // Resize to desktop with the menu open must restore document scrolling.
 await page.setViewportSize({width:390,height:844});await open();await page.setViewportSize({width:1440,height:900});await closed();
 await page.waitForFunction(()=>getComputedStyle(document.body).overflow!=='hidden');
 // Local SSR-only authenticated fixture. No real credentials or auth requests.
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('fixture').join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id}})).toString('base64url');
 await context.addCookies([...new Set(['sb-127-auth-token',browserStorageKey])].map(name=>({name,value,domain:'localhost',path:'/'})));
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:4051',{waitUntil:'networkidle'});await open();
 await menu.getByRole('link',{name:'My Account',exact:true}).tap();await page.waitForURL('**/account');await closed();
 await open();assert.equal(await menu.getByRole('button',{name:'Log out',exact:true}).isVisible(),true);await page.keyboard.press('Escape');await closed();
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 console.log('PASS: real touch navigation on all anonymous links + authenticated Account, null-relatedTarget regression, outside/toggle/Escape/keyboard, short-screen scroll/targets/overflow, background lock cleanup and desktop navigation. Local fixtures; no production writes.');
}finally{await browser?.close();app.kill();await new Promise(r=>api.close(r));}
