// All responses are synthetic. No network, credentials, DB or mutation.
import assert from 'node:assert/strict';
import {verifyPublicApplication} from '../scripts/member-deployment/release-gate.mjs';
import {verifyStreamRedirect} from '../scripts/member-deployment/stream-redirect.mjs';
import {streamFixture} from './fixtures/member-stream.mjs';
let passed = 0;
const htmlResponse = html => new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});
async function smoke(admin) {
  await verifyPublicApplication(async (url, options) => {
    assert.equal(new URL(url).origin,'https://kgroov.com');
    assert.equal(options.method,'GET'); assert.equal(options.credentials,'omit');
    assert.equal(options.redirect,'manual'); assert.equal(options.cache,'no-store');
    assert.equal(options.headers,undefined); assert.ok(options.signal);
    return new URL(url).pathname.startsWith('/admin/') ? admin(new URL(url).pathname) : new Response('KGROOV');
  });
}
async function denied(admin) {await assert.rejects(()=>smoke(admin),e=>e.message==='NEW_APPLICATION_SMOKE_FAILED');passed++;}
for(const status of [302,303,307,308]) for(const location of ['/login','/login?next=/admin/community','https://kgroov.com/login']) {
  await smoke(()=>new Response(null,{status,headers:{location}}));passed++;
}
await smoke(path=>htmlResponse(streamFixture(path)));passed++;
for(const location of ['https://evil.invalid/login','//evil.invalid/login','https://kgroov.com.evil.invalid/login','https://u:p@kgroov.com/login','/login?next=https://evil.invalid','/login#fragment','/login?next=/admin/member-policy','/login?x=1','/login?next=/admin/community&next=//evil.invalid','/login/','/LOGIN','/community','/\\evil.invalid/login']) {
  await denied(()=>new Response(null,{status:307,headers:{location}}));
}
for(const response of [()=>new Response('KGROOV Login',{status:200}),()=>new Response(null,{status:307}),()=>new Response(null,{status:404}),()=>new Response('PRIVATE',{status:500}),()=>new Response(streamFixture(),{headers:{'content-type':'application/json'}}),()=>new Response(streamFixture(),{headers:{'content-type':'text/html',location:'/login'}})]) await denied(response);
const mutations = [
  h=>h.replace('1;url=/login?next=/admin/community','1;url=https://evil.invalid/login'),
  h=>h.replace('1;url=','0;url='),
  h=>h.replace('<meta ', '<!-- <meta ').replace('/></head>','/> --></head>'),
  h=>h.replace('<meta ', '<template><meta ').replace('/></head>','/></template></head>'),
  h=>h.replace('<meta ', '<title><meta ').replace('/></head>','/></title></head>'),
  h=>h.replace('<meta ', '<noscript><meta ').replace('/></head>','/></noscript></head>'),
  h=>h.replace('<meta ', '<textarea><meta ').replace('/></head>','/></textarea></head>'),
  h=>h.replace('<body>','<body onload="alert(1)">'),
  h=>h.replace('http-equiv="refresh"','http-equiv="x-refresh"'),
  h=>h.replace('</head>','<meta http-equiv="refresh" content="0;url=https://evil.invalid"/></head>'),
  h=>h.replace('data-dgst="NEXT_REDIRECT','data-dgst="OTHER'),
  h=>h.replace('</main>','<h1>Private queue</h1></main>'),
  h=>h.replace('</main>','<div hidden>Private queue</div></main>'),
  h=>h.replace('Loading KGROOV…','Private content'),
  h=>h.replace('</body>','<form><button>Approve</button></form></body>'),
  h=>h.replace('</body>','<script>location.href="/login"</script></body>'),
  h=>h.replace('</body>','<script src="/_next/static/chunks/x.js" onload="alert(1)"></script></body>'),
  h=>h.replace('</head>','<base href="https://evil.invalid"/></head>'),
  h=>h.replace('</head>','<iframe src="/admin/community"></iframe></head>'),
  h=>h.slice(0,-7), h=>h+' ', h=>'x'.repeat(512*1024)+h,
];
for(const [index,change] of mutations.entries()) {
  try {await denied(path=>htmlResponse(change(streamFixture(path))));}
  catch {throw Error(`STREAM_MUTATION_NOT_REJECTED_${index}`);}
}
for(const change of [
  f=>f.replace('NEXT_REDIRECT;replace;','NEXT_REDIRECT;push;'),
  f=>f.replace(';307;',';308;'),
  f=>f.replace('"$L6"','"$L7"'),
  f=>f.replace('6:E','7:E'),
  f=>f.replace('"initialAuthenticated":false','"initialAuthenticated":true'),
  f=>f+'7:{"body":"Private content"}\n',
  f=>f+'7:"Private content"\n',
  f=>f+f, f=>f.replace('"digest":','"body":"Private content","digest":'),
]) await denied(path=>htmlResponse(streamFixture(path,change)));
await denied(()=>htmlResponse(streamFixture('/wrong')));
await denied(()=>{const r=htmlResponse(streamFixture());Object.defineProperty(r,'redirected',{value:true});return r;});
let canceled=false;
await denied(()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(512*1024+1));},cancel(){canceled=true;}}),{headers:{'content-type':'text/html'}}));
assert.ok(canceled);passed++;
await denied(()=>new Response(new ReadableStream({start(c){c.error(Error('PRIVATE'));}}),{headers:{'content-type':'text/html'}}));
assert.throws(()=>verifyStreamRedirect(streamFixture(),'/admin/other'));passed++;
console.log(JSON.stringify({result:'PASS',assertions:passed,scope:'offline strict anonymous stream/HTTP redirect; malformed/private/oversize/error responses fail closed'}));
