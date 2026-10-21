// Offline Vercel adapter/metadata/smoke contract tests. Never calls real services.
import assert from 'node:assert/strict';
import {vercelReader,verifyDeployment,verifyPublicApplication} from '../scripts/member-deployment/release-gate.mjs';
const sha='a'.repeat(40),projectId='prj_synthetic',domain='kgroov.com';
let calls=0;
const reader=vercelReader('synthetic-test-token','team_synthetic',async(url,options)=>{
 calls++;assert.equal(new URL(url).origin,'https://api.vercel.com');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
 return new Response(JSON.stringify({projectId,deployment:{id:'dpl_synthetic'},env:{secret:'PRIVATE'},creator:{email:'PRIVATE'}}));
});
await assert.rejects(()=>reader('/v9/projects/anything/env'));
assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(await reader('/v4/aliases/kgroov.com')),/PRIVATE|secret|email/);
await assert.rejects(()=>vercelReader('synthetic','team_synthetic',async()=>{throw Error('PRIVATE')})('/v4/aliases/kgroov.com'),e=>e.message==='VERCEL_READ_UNAVAILABLE');
const request=async p=>p.startsWith('/v4/')?{projectId,deployment:{id:'dpl_synthetic'}}:{projectId,id:'dpl_synthetic',target:'production',readyState:'READY',meta:{githubCommitSha:sha}};
assert.equal(await verifyDeployment(request,{sha,projectId,domain}),'dpl_synthetic');
for(const key of ['projectId','target','readyState','meta'])await assert.rejects(()=>verifyDeployment(async p=>{const r=await request(p);if(!p.startsWith('/v4/'))r[key]=null;return r;},{sha,projectId,domain}));
let aliases=0;await assert.rejects(()=>verifyDeployment(async p=>{const r=await request(p);if(p.startsWith('/v4/')&&++aliases>1)r.deployment.id='dpl_changed';return r;},{sha,projectId,domain}));
await assert.rejects(()=>verifyPublicApplication(async()=>new Response('PRIVATE',{status:500})),e=>e.message==='NEW_APPLICATION_SMOKE_FAILED');
await assert.rejects(()=>verifyPublicApplication(async url=>new URL(url).pathname.startsWith('/admin/')?new Response(null,{status:307,headers:{location:'https://example.invalid/login'}}):new Response('KGROOV')));
await verifyPublicApplication(async url=>new URL(url).pathname.startsWith('/admin/')?new Response(null,{status:307,headers:{location:'/login'}}):new Response('KGROOV'));
console.log('PASS: release metadata, alias switch, anonymous smoke, fixed paths, GET-only and error/response redaction; offline.');
