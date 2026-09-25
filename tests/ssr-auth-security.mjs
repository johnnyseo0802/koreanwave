// Local fixtures only: every Auth request is mocked. No env or real accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const { createServerClient } = require('@supabase/ssr');
function load(path, dependencies) {
  const context = { exports: {}, Headers, require: name => name === 'server-only' ? {} : dependencies[name] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const baseImports = { 'next/server': { NextRequest, NextResponse }, '@/lib/supabase/config': { getSupabaseServerConfig: () => ({ url: 'https://fixture.supabase.test', publishableKey: 'local-fixture-only' }) } };
let claimsCalls = 0;
const unit = load('src/lib/supabase/proxy.ts', { ...baseImports, '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: { getClaims: async () => {
  claimsCalls++;
  options.cookies.setAll([{ name: 'session.0', value: 'fixture-a', options: { path: '/', sameSite: 'lax', secure: true } }, { name: 'old.1', value: '', options: { path: '/', maxAge: 0 } }], { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' });
  options.cookies.setAll([{ name: 'session.1', value: 'fixture-b', options: { path: '/', sameSite: 'lax', secure: true } }], {});
  return { data: { claims: {} }, error: null };
} } }) } });
const request = new NextRequest('http://localhost/account', { headers: { cookie: 'old.1=obsolete; unrelated=keep' } });
const response = await unit.updateSession(request);
assert.equal(claimsCalls, 1);
assert.equal(request.cookies.get('session.0').value, 'fixture-a');
assert.equal(request.cookies.get('session.1').value, 'fixture-b');
assert.equal(request.cookies.has('old.1'), false);
assert.equal(request.cookies.get('unrelated').value, 'keep');
assert.equal(response.cookies.get('session.0').secure, true);
assert.equal(response.cookies.get('session.1').sameSite, 'lax');
assert.equal(response.cookies.get('old.1').maxAge, 0);
assert.ok(response.headers.get('x-middleware-request-cookie').includes('session.1='));
assert.match(response.headers.get('Cache-Control'), /private.*no-store/);
assert.equal(response.headers.get('Expires'), '0');
assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store');

// Exercise installed SSR/Auth SDK's real expiry/refresh path against a fake server.
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const jwt = seconds => [ { alg: 'HS256', typ: 'JWT' }, { sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now()/1000)+seconds, iat: Math.floor(Date.now()/1000)-100 } ].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('local-fixture-signature').join('.');
let requests = [], invalidRefresh = false;
const fakeFetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  requests.push(url.pathname);
  if (url.pathname === '/auth/v1/token') return new Response(JSON.stringify(invalidRefresh ? { code: 'refresh_token_not_found', message: 'Fixture rejection' } : { access_token: jwt(3600), refresh_token: 'rotated-local-fixture', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user }), { status: invalidRefresh ? 400 : 200, headers: { 'content-type': 'application/json' } });
  if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify(user), { status: 200, headers: { 'content-type': 'application/json' } });
  throw new Error('Unexpected mocked Auth endpoint');
};
const sdk = load('src/lib/supabase/proxy.ts', { ...baseImports, '@supabase/ssr': { createServerClient: (url, key, options) => createServerClient(url, key, { ...options, global: { fetch: fakeFetch } }) } });
function cookie(seconds) {
  const session = { access_token: jwt(seconds), refresh_token: 'local-fixture-refresh', expires_at: Math.floor(Date.now()/1000)+seconds, expires_in: seconds, token_type: 'bearer', user };
  return 'sb-fixture-auth-token=base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
}
for (const seconds of [-60, 5]) {
  requests = [];
  const req = new NextRequest('http://localhost/account', { headers: { cookie: cookie(seconds) } });
  const res = await sdk.updateSession(req);
  assert.ok(requests.includes('/auth/v1/token'), 'Expired/near-expired session refresh requested');
  assert.ok(res.cookies.getAll().some(c=>c.name.startsWith('sb-fixture-auth-token') && c.value), 'Refreshed cookie returned');
  assert.ok(res.headers.get('x-middleware-request-cookie'), 'Refreshed cookie forwarded to render');
  assert.match(res.headers.get('Cache-Control'), /no-store/);
}
invalidRefresh = true;
// The SDK logs rejected initialization internally; suppress only this local fixture.
const savedError = console.error;
let expired;
try {
  console.error = () => {};
  expired = await sdk.updateSession(new NextRequest('http://localhost/account', { headers: { cookie: cookie(-60) } }));
} finally { console.error = savedError; }
assert.ok(expired.cookies.getAll().some(c=>c.name.startsWith('sb-fixture-auth-token') && c.maxAge === 0), 'Invalid refresh is removed by SDK');
requests = [];
const anon = await sdk.updateSession(new NextRequest('http://localhost/events'));
assert.equal(anon.status, 200);
assert.equal(requests.length, 0);
assert.equal(anon.cookies.getAll().length, 0);
assert.equal(anon.headers.has('location'), false);

const outage = load('src/lib/supabase/proxy.ts', { ...baseImports, '@supabase/ssr': { createServerClient: () => ({ auth: { getClaims: async () => { throw new Error('private fixture error'); } } }) } });
assert.equal((await outage.updateSession(new NextRequest('http://localhost/'))).status, 200);
const { config } = load('src/proxy.ts', { '@/lib/supabase/proxy': sdk });
const { unstable_doesMiddlewareMatch: unstable_doesProxyMatch } = require('next/experimental/testing/server');
for (const url of ['/', '/login', '/signup', '/auth/confirm', '/auth/confirm/server', '/account', '/account/events', '/write', '/admin/content']) assert.ok(unstable_doesProxyMatch({ config, nextConfig: {}, url }));
for (const url of ['/_next/static/chunk.js', '/_next/image?url=x', '/favicon.ico', '/photo.webp', '/font.woff2']) assert.equal(unstable_doesProxyMatch({ config, nextConfig: {}, url }), false);
assert.ok(!fs.existsSync('src/middleware.ts') && !fs.existsSync('middleware.ts'));
assert.match(fs.readFileSync('src/app/layout.tsx','utf8'), /dynamic = "force-dynamic"/);
// Callback fixtures: fixed destinations, supported methods, no raw errors/query echo.
for (const [query, method, failure] of [
  ['code=fixture&next=https://external.test', 'code', false],
  ['token_hash=fixture&type=signup', 'otp', false],
  ['token_hash=fixture&type=email', 'otp', false],
  ['token_hash=fixture&type=recovery', null, false],
  ['', null, false],
  ['code=fixture', 'code', true],
]) {
  const calls = [];
  const callback = load('src/app/auth/confirm/server/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      verifyOtp: async () => { calls.push('otp'); return { error: null }; },
      exchangeCodeForSession: async () => { calls.push('code'); if (failure) throw new Error('private fixture'); return { error: null }; },
    } }) },
  });
  const result = await callback.GET(new NextRequest(`http://localhost/auth/confirm/server?${query}`));
  assert.deepEqual(calls, method ? [method] : []);
  assert.equal(result.headers.get('location'), `http://localhost/auth/${method && !failure ? 'confirmed' : 'confirmation-failed'}`);
  assert.match(result.headers.get('cache-control'), /no-store/);
  assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
}
// Client callback runs in an isolated mocked browser; no actual email links/session.
for (const [search, hash, verified, expected] of [
  ['', '#access_token=fixture&refresh_token=fixture', true, '/auth/confirmed'],
  ['', '#access_token=fixture&refresh_token=fixture', false, '/auth/confirmation-failed'],
  ['', '#error=expired', true, '/auth/confirmation-failed'],
  ['', '', true, '/auth/confirmation-failed'],
  ['?code=fixture&next=https://external.test', '', true, '/auth/confirm/server?code=fixture'],
]) {
  let effect, destination, cleaned = false, verifiedCalls = 0;
  const context = {
    exports: {}, URLSearchParams,
    window: { location: { search, hash, pathname: '/auth/confirm', replace: value => { destination = value; } }, history: { replaceState: (_s, _t, value) => { cleaned = value === '/auth/confirm'; } } },
    require: name => ({
      react: { useEffect: fn => { effect = fn; }, useRef: () => ({ current: false }) },
      'react/jsx-runtime': { jsx: () => null },
      'next/navigation': { useRouter: () => ({ replace: value => { destination = value; } }) },
      '@/lib/supabase/client': { createClient: () => ({ auth: { getUser: async () => { verifiedCalls++; return { data: { user: verified ? { email_confirmed_at: 'fixture' } : null }, error: null }; } } }) },
    })[name],
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/auth/confirm/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  context.exports.default();
  effect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(destination, expected);
  assert.equal(cleaned, true);
  assert.equal(verifiedCalls, hash.startsWith('#access_token') ? 1 : 0);
}
console.log('PASS: real installed SDK expiry/near-expiry refresh with mocked Auth, cookie request+response propagation, chunk/deletion/header preservation, invalid-session cleanup, anonymous/outage behavior, matcher and dynamic caching. No real credentials, network or DB writes.');
