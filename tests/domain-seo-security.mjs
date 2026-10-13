// Offline only: synthetic rows, no .env, provider, production or database calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = p => fs.readFileSync(p, 'utf8');
let fetchOptions;
function load(path, imports = {}) {
  const context = { exports: {}, URL, AbortSignal, fetch: async (_, init) => { fetchOptions = init; return {}; },
    require: n => n === 'server-only' ? {} : imports[n] };
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const origin = load('src/lib/site-origin.ts');
const editorial = load('src/lib/editorial.ts');
const clusters = load('src/lib/clusters.ts');
const metadata = load('src/lib/public-metadata.ts', {
  '@/lib/site-origin': origin, '@/lib/brand': load('src/lib/brand.ts'),
  '@/lib/media': { safeMediaUrl: () => null },
});
for (const path of ['/', '/articles/synthetic', '/local-korea/guides', '/community/posts/synthetic']) {
  const m = metadata.publicPageMetadata('Safe title', path);
  assert.equal(m.alternates.canonical, 'https://kgroov.com' + path);
  assert.equal(m.openGraph.url, m.alternates.canonical);
  assert.equal(m.openGraph.images[0].url, 'https://kgroov.com/opengraph-image');
  assert.equal(m.twitter.images[0], 'https://kgroov.com/opengraph-image');
}
const configs = {
  editorial_articles:['published','/articles'], places:['published','/local-korea/places'],
  experiences:['published','/local-korea/experiences'], events:['published','/event'],
  questions:['approved','/community/questions'], community_posts:['approved','/community/posts'],
  content_clusters:['published','/explore'],
};
const id = n => 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(n).padStart(12, '0');
let fail = false, forged = false, hidden = false, options, calls = [];
const client = { from(table) {
  assert.ok(configs[table], 'Only reviewed public tables may be queried');
  const q = { table };
  const builder = {
    select(fields) { q.fields = fields; assert.equal(fields, table === 'content_clusters' ? 'id,slug,status' : 'id,status'); return this; },
    eq(column, value) { assert.equal(column, 'status'); assert.equal(value, configs[table][0]); return this; },
    order(column, opts) { assert.equal(column, 'id'); assert.equal(opts.ascending, true); return this; },
    limit(n) { assert.equal(n, 500); return this; },
    gt(column, value) { assert.equal(column, 'id'); q.after = value; return this; },
    then(resolve) {
      calls.push(q);
      const rows = [1,2,3].map(n => ({ id:id(n), slug:'safe-' + n, status:configs[table][0] }));
      rows.push({ id:id(4), slug:'private-sentinel', status:table === 'questions' || table === 'community_posts' ? 'pending' : 'draft' });
      let data = rows.filter(row => row.status === configs[table][0] && (!q.after || row.id > q.after)).slice(0, 2);
      if (hidden) data = [];
      if (forged) data = [rows.at(-1)];
      return Promise.resolve(resolve({ data, error:fail ? { message:'RAW PRIVATE ERROR' } : null }));
    },
  };
  return builder;
} };
const sitemap = load('src/lib/public-sitemap.ts', {
  '@supabase/supabase-js': { createClient: (url, key, opts) => { assert.equal(url, 'http://mock.invalid'); assert.equal(key,'mock-publishable-only'); options = opts; return client; } },
  '@/lib/supabase/config': { getSupabaseServerConfig: () => ({ url:'http://mock.invalid', publishableKey:'mock-publishable-only' }) },
  '@/lib/site-origin':origin, '@/lib/editorial':editorial, '@/lib/clusters':clusters,
});
let urls = (await sitemap.publicSitemap()).map(x => x.url);
assert.equal(urls.length, sitemap.staticPublicPaths.length + 21);
assert.equal(new Set(urls).size, urls.length);
for (const [table, [,path]] of Object.entries(configs)) for (const n of [1,2,3])
  assert.ok(urls.includes('https://kgroov.com' + path + '/' + (table === 'content_clusters' ? 'safe-' + n : id(n))));
assert.ok(!urls.some(url => /private|admin|account|auth|signup|login|search|write/.test(new URL(url).pathname)));
assert.ok(calls.some(c => c.after === id(2)) && calls.some(c => c.after === id(3)), 'API caps must not truncate paging');
assert.equal(options.auth.persistSession, false);
assert.equal(options.auth.autoRefreshToken, false);
assert.equal(options.auth.detectSessionInUrl, false);
await options.global.fetch('http://mock.invalid', {cache:'force-cache'});
assert.equal(fetchOptions.cache, 'no-store');
assert.ok(fetchOptions.signal);
hidden = true;
assert.equal((await sitemap.publicSitemap()).length, sitemap.staticPublicPaths.length, 'Unpublish must be reflected on the next read');
hidden = false; fail = true;
await assert.rejects(sitemap.publicSitemap(), { message:'Public sitemap temporarily unavailable.' });
fail = false; forged = true;
await assert.rejects(sitemap.publicSitemap(), { message:'Public sitemap temporarily unavailable.' });
assert.doesNotMatch(read('src/lib/public-sitemap.ts'), /cookies\(|authorization|service_role|SECRET|\.rpc\(|\.insert\(|\.update\(|\.delete\(|console\./i);
assert.match(read('src/app/sitemap.ts'), /dynamic = "force-dynamic"/);
const robots = load('src/app/robots.ts', {'@/lib/site-origin':origin}).default();
assert.equal(robots.rules.allow, '/'); assert.equal(robots.sitemap, 'https://kgroov.com/sitemap.xml');
for (const path of sitemap.staticPublicPaths) {
  const page = read('src/app' + (path === '/' ? '' : path) + '/page.tsx');
  assert.match(page, /publicPageMetadata\(/);
}
for (const area of ['account','admin','auth','write'])
  assert.match(read('src/app/' + area + '/layout.tsx'), /index:\s*false/);
for (const page of ['login','signup','search'])
  assert.match(read('src/app/' + page + '/page.tsx'), /index:\s*false/);
for (const marker of ['emailRedirectTo:', 'window.location.origin', '/auth/confirm'])
  assert.ok(read('src/components/signup-form.tsx').includes(marker));
assert.match(read('src/app/auth/confirm/server/route.ts'), /exchangeCodeForSession/);
assert.match(read('src/app/auth/confirm/server/route.ts'), /verifyOtp/);
assert.match(read('src/app/community/questions/[id]/page.tsx'), /\.eq\("status", "approved"\)/);
assert.match(read('src/app/community/posts/[id]/page.tsx'), /const post = await publicPost\(id\)/);
assert.match(read('src/lib/community-data.ts'), /\.eq\("status",\s*"approved"\)/);
console.log('PASS: official canonical/OG, anonymous public-only sitemap, pagination, fail-closed errors/unpublish, no private identity, noindex, unchanged confirmation path. Offline mocks only.');
