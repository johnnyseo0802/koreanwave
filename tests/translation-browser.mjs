// Real Next Server Action + mobile browser; mock Auth/cache/provider on loopback.
// No real credentials, provider calls, production queries or source writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`,date='2026-10-05T01:00:00Z';
const korean='성수 주말은 진짜 너무 붐벼서 난 별로였음 ㅋㅋ ';
const english='This is my honest opinion and I do not like the crowd. ';
const japanese='週末の聖水は混みすぎて微妙だった笑 😂 ';
const post={id:id(1),title:'Translation fixture',body:korean.repeat(30),type:'discussion',status:'approved',published_at:date};
const comments=[{id:id(2),post_id:id(1),parent_comment_id:null,body:english.repeat(15),status:'approved',created_at:date},{id:id(3),post_id:id(1),parent_comment_id:id(2),body:english+'<script>window.unsafe=true</script>',status:'approved',created_at:date}];
const cache=[];let calls=0,fail=false,writes=0;const directions=new Set();
const api=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4072');res.setHeader('Content-Type','application/json');
 let raw='';for await(const b of req)raw+=b;const payload=raw?JSON.parse(raw):{};
 const end=value=>res.end(JSON.stringify(value));
 if(url.pathname==='/provider'){
  calls++;assert.equal(payload.store,false);assert.equal(payload.tools,undefined);
  const source=JSON.parse(payload.input[0].content).source_text;assert.ok([post.body,...comments.map(c=>c.body)].includes(source));
  await new Promise(r=>setTimeout(r,350));
  if(fail){res.writeHead(503);end({error:{message:'RAW_SECRET_FIXTURE_ERROR'}});return;}
  const pair=payload.instructions.match(/from (ko|en|ja) to (ko|en|ja)/);assert.ok(pair);directions.add(`${pair[1]}-${pair[2]}`);
  end({status:'completed',output:[{type:'message',content:[{type:'output_text',text:({en:english,ko:korean,ja:japanese})[pair[2]].repeat(20)}]}]});return;
 }
 if(url.pathname==='/auth/v1/user'){end({id:id(99),aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:date});return;}
 const table=url.pathname.split('/').at(-1);
 if(url.pathname.includes('/rpc/')){
  if(table==='claim_conversation_translation'){
   const k={content_type:payload.p_type,content_id:payload.p_id,source_language:payload.p_source,target_language:payload.p_target,source_hash:payload.p_hash};
   const existing=cache.find(r=>Object.entries(k).every(([key,value])=>r[key]===value));
   if(existing?.translated_text){end({state:'hit',text:existing.translated_text});return;}
   const row=existing??{id:id(100+cache.length),...k};if(!existing)cache.push(row);row.lease='fixture-lease';end({state:'claimed',id:row.id,lease:row.lease});return;
  }
  if(table==='finish_conversation_translation'){cache.find(r=>r.id===payload.p_id).translated_text=payload.p_text;end(true);return;}
  end([]);return;
 }
 if(req.method!=='GET'){writes++;res.writeHead(405);end({});return;}
 let rows={community_posts:[post],community_comments:comments,conversation_translations:cache,profiles:[{role:'member'}]}[table]??[];
 for(const[k,v]of url.searchParams){if(v.startsWith('eq.'))rows=rows.filter(r=>String(r[k])===v.slice(3));if(v==='is.null')rows=rows.filter(r=>r[k]===null);if(v.startsWith('in.('))rows=rows.filter(r=>v.slice(4,-1).split(',').includes(r[k]));}
 const fields=url.searchParams.get('select');if(fields)rows=rows.map(r=>Object.fromEntries(fields.split(',').filter(k=>k in r).map(k=>[k,r[k]])));
 end(String(req.headers.accept).includes('vnd.pgrst.object')?(rows[0]??null):rows);
});
await new Promise(r=>api.listen(4072,'127.0.0.1',r));
const app=spawn(process.execPath,['--require','./tests/fixtures/translation-provider.cjs','node_modules/next/dist/bin/next','start','--port','4071'],{env:{...process.env,KWC_TRANSLATION_FIXTURE:'local-4072',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4072',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only',SUPABASE_TRANSLATION_SECRET_KEY:'sb_secret_local_fixture_only',OPENAI_API_KEY:'local-fixture-only',OPENAI_TRANSLATION_MODEL:'fixture-model'},stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://localhost:4071/community/posts/'+id(1))).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(i===59)throw Error('Fixture did not start');}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
 const goto=async()=>page.goto('http://localhost:4071/community/posts/'+id(1),{waitUntil:'networkidle'});
 const block=n=>page.locator(`[data-translation-content="${id(n)}"]`);
 await goto();assert.equal(calls,0);await block(1).getByRole('link',{name:'Log in to translate'}).click();
 await page.waitForURL(u=>u.pathname==='/login'&&u.searchParams.get('next')==='/community/posts/'+id(1));
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:id(99),aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('fixture').join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:id(99)}})).toString('base64url');
 await context.addCookies([{name:'sb-127-auth-token',value,domain:'localhost',path:'/'}]);
 await goto();assert.equal(calls,0,'No mount translation');
 assert.ok((await block(1).innerText()).includes(korean.trim()));
 const translate=block(1).getByRole('button',{name:'Translate to English'});assert.ok((await translate.boundingBox()).height>=44);
 await translate.dblclick();await block(1).getByRole('button',{name:'Translating…'}).waitFor();
 assert.equal(await block(1).getByRole('button',{name:'Translating…'}).isDisabled(),true);
  try { await block(1).getByText('Translated from Korean · AI translation').waitFor(); }
  catch { throw Error(`Translation fixture failed: provider calls=${calls}, cache rows=${cache.length}, message=${await block(1).getByRole('status').innerText()}`); }
  assert.equal(calls,1);
 assert.equal(await block(1).locator('p[hidden]').count(),1,'Original retained in DOM');
 await block(1).getByRole('button',{name:'Show original'}).click();assert.ok((await block(1).innerText()).includes(korean.trim()));
 await block(1).getByRole('button',{name:'Translate to English'}).click();assert.equal(calls,1,'Client toggle no provider');
 assert.equal(await block(2).getByText(/Translated from/).count(),0);assert.equal(await block(3).getByText(/Translated from/).count(),0);
 fail=true;await block(2).getByRole('button',{name:'Translate to Korean'}).click();await block(2).getByText(/temporarily unavailable/).waitFor();assert.ok((await block(2).innerText()).includes(english.trim()));
 assert.doesNotMatch(await page.locator('body').innerText(),/RAW_SECRET_FIXTURE_ERROR|author_id|sb_secret/);
 fail=false;await block(2).getByRole('button',{name:'Translate to Korean'}).click();await block(2).getByText('Translated from English · AI translation').waitFor();
 assert.equal(await block(3).getByText(/Translated from/).count(),0,'Root request does not translate reply');
 await block(3).getByRole('button',{name:'Translate to Korean'}).click();await block(3).getByText('Translated from English · AI translation').waitFor();
 const before=calls;await goto();await block(1).getByRole('button',{name:'Translate to English'}).click();await block(1).getByText(/Translated from Korean/).waitFor();assert.equal(calls,before,'Persistent cache survives page load');
 // Target selection is explicit, excludes source, and does not auto-call provider.
 const targets=async n=>block(n).locator('select option').evaluateAll(options=>options.map(o=>o.value));
 assert.deepEqual(await targets(1),['en','ja']);assert.deepEqual(await targets(2),['ko','ja']);
 assert.equal(await block(1).getByLabel('Translate into').isEnabled(),true);
 for(const n of [1,2]){
  const prior=calls;await block(n).getByLabel('Translate into').selectOption('ja');assert.equal(calls,prior);
  await block(n).getByRole('button',{name:'Translate to Japanese'}).click();
  await block(n).getByRole('button',{name:'Show original'}).waitFor();assert.equal(calls,prior+1);
  assert.ok((await block(n).locator('p[lang="ja"]').innerText()).includes(japanese.trim()));
 }
 // Japanese source fixture represents an existing public reply, not a DB write.
 comments[1].body=japanese.repeat(20);await goto();assert.deepEqual(await targets(3),['en','ko']);
 for(const [language,label]of [['en','English'],['ko','Korean']]){
  await block(3).getByLabel('Translate into').selectOption(language);
  await block(3).getByRole('button',{name:`Translate to ${label}`}).click();
  await block(3).getByText('Translated from Japanese · AI translation').waitFor();
  assert.ok(await block(3).locator(`p[lang="${language}"]`).isVisible());
 }
 const reused=calls;await block(3).getByLabel('Translate into').selectOption('en');await block(3).getByRole('button',{name:'Translate to English'}).click();assert.equal(calls,reused,'Per-language client cache reused');
 assert.deepEqual([...directions].sort(),['en-ja','en-ko','ja-en','ja-ko','ko-en','ko-ja']);
 await mkdir('.next/translation-qa',{recursive:true});
 for(const[width,height]of [[390,844],[390,320],[768,900],[1440,900]]){
  await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await block(1).getByRole('button').focus();assert.equal(await block(1).getByRole('button').evaluate(el=>el===document.activeElement),true);
  await block(3).getByLabel('Translate into').focus();assert.equal(await block(3).getByLabel('Translate into').evaluate(el=>el===document.activeElement),true);
  assert.ok((await block(3).getByLabel('Translate into').boundingBox()).height>=44);
  await page.screenshot({path:`.next/translation-qa/${width}x${height}.png`,fullPage:true});
 }
 assert.equal(await page.evaluate(()=>window.unsafe),undefined);assert.equal(writes,0);assert.deepEqual(errors,[]);
 console.log('PASS: translation mobile/desktop; all six EN/KO/JA pairs, source-excluding accessible select, no auto calls, per-target cache, auth, loading/double click, failure/original/retry, independent replies, keyboard/44px/wrapping, no production writes.');
}finally{
 await browser?.close();app.kill();await new Promise(r=>api.close(r));
}
