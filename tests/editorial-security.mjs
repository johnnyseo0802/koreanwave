// Offline only. No Supabase connection, credentials, SQL execution or real writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(path, 'utf8');
function load(path, imports = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: name => {
    if (name === 'server-only') return {};
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }, FormData, URL, Date });
  return loadedModule.exports;
}
const model = load('src/lib/editorial.ts');
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ section: 'k-contents', category: 'music', title: 'A valid title', summary: 'A useful editorial summary.', body: 'A plain-text editorial body long enough for validation.', status: 'draft', ...overrides })) data.set(key, value);
  return data;
}
assert.ok(model.validateEditorial(form()).value);
for (const [section, categories] of Object.entries(model.editorialCategories)) for (const category of Object.keys(categories)) assert.ok(model.validateEditorial(form({ section, category })).value);
for (const bad of [{ category: 'beauty' }, { category: '__proto__' }, { section: 'other' }, { status: 'approved' }, { title: ' ' }, { title: 'x'.repeat(161) }, { summary: 'short' }, { body: 'x'.repeat(30001) }, { image_url: 'javascript:alert(1)' }]) assert.ok(model.validateEditorial(form(bad)).error);
assert.equal(model.textLength('😀'), 1);
for (const url of ['http://images.example.org/a', '//evil.org/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://user:pass@host.org/a', 'https://host.local/a', 'https://host.org:444/a', 'https://host.org/ x', 'data:image/svg+xml,x']) assert.equal(model.safeEditorialUrl(url), null);
assert.equal(model.safeEditorialUrl('https://images.example.org/a.jpg'), 'https://images.example.org/a.jpg');
const injected = model.validateEditorial(form({ role: 'admin', id: 'injected', published_at: 'injected' })).value;
assert.equal(injected.role, undefined);
assert.equal(injected.id, undefined);
assert.equal(injected.published_at, undefined);

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const revision = '2026-09-25T01:00:00.000001+00:00';
let calls = [], result = { data: { id, updated_at: revision }, error: null };
const chain = new Proxy({}, { get: (_, name) => name === 'then' ? resolve => Promise.resolve(result).then(resolve) : (...args) => { calls.push([name, ...args]); return chain; } });
const client = { from: name => { calls.push(['from', name]); return chain; } };
let access = { status: 'admin', client };
const actions = load('src/app/admin/content/actions.ts', {
  '@/lib/auth/admin-access': { getAdminAccess: async () => access },
  '@/lib/editorial': model,
  'next/cache': { revalidatePath() {} },
});
for (const status of ['unauthenticated', 'forbidden', 'unavailable']) {
  access = { status }; calls = [];
  assert.equal((await actions.saveArticle(null, null, form())).ok, false);
  assert.equal(calls.length, 0);
}
access = { status: 'admin', client };
calls = [];
assert.equal((await actions.saveArticle(null, null, form({ published_at: 'forged', status: 'published' }))).ok, true);
assert.deepEqual(Object.keys(calls.find(c => c[0] === 'insert')[1]).sort(), ['body', 'category', 'image_url', 'section', 'source_url', 'status', 'summary', 'title']);
calls = [];
assert.equal((await actions.saveArticle(id, revision, form())).ok, true);
assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === id));
assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'updated_at' && c[2] === revision));
result = { data: null, error: null };
assert.equal((await actions.saveArticle(id, revision, form())).ok, false);
result = { data: null, error: { message: 'PRIVATE_DATABASE_ERROR', code: '42501' } };
assert.ok(!(await actions.saveArticle(id, revision, form())).message.includes('PRIVATE_DATABASE_ERROR'));

const publicData = load('src/lib/editorial-data.ts', { '@/lib/editorial': model, '@/lib/supabase/server': { createClient: async () => client } });
result = { data: [], error: null };
calls = [];
await publicData.listPublicArticles('k-trends', 'food');
assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'status' && c[2] === 'published'));
assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'category' && c[2] === 'food'));
assert.ok(calls.some(c => c[0] === 'order' && c[1] === 'published_at' && c[2].ascending === false));
for (const state of ['draft', 'missing', 'query-error']) {
  result = { data: null, error: state === 'query-error' ? { message: 'private' } : null };
  calls = [];
  assert.equal(await publicData.getPublicArticle(id), null);
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'status' && c[2] === 'published'));
  assert.ok(!calls.find(c => c[0] === 'select')[1].includes('author_id'));
}
const navigation = { redirect: () => { throw new Error('redirect'); }, notFound: () => { throw new Error('404'); } };
const admin = load('src/lib/editorial-admin.ts', { '@/lib/editorial': model, '@/lib/auth/admin-access': { getAdminAccess: async () => access }, 'next/navigation': navigation });
access = { status: 'unauthenticated' };
await assert.rejects(admin.requireEditorialAdmin('/admin/content'), /redirect/);
access = { status: 'forbidden' };
await assert.rejects(admin.requireEditorialAdmin('/admin/content'), /404/);

const sql = read('supabase/migrations/20260925000000_create_editorial_articles.sql');
assert.equal((sql.match(/create table /g) || []).length, 1);
assert.equal((sql.match(/create policy /g) || []).length, 4);
assert.match(sql, /enable row level security/);
assert.match(sql, /for select to anon, authenticated using \(status = 'published'\)/);
assert.match(sql, /p\.id = \(select auth\.uid\(\)\) and p\.role = 'admin'/);
assert.match(sql, /for update to authenticated\s+using[\s\S]+with check/);
assert.doesNotMatch(sql, /grant (?:all|delete|update on)/i);
for (const grant of sql.matchAll(/grant (?:insert|update) \(([^)]+)\)/g)) assert.doesNotMatch(grant[1], /published_at|created_at|updated_at|\bid\b/);
assert.match(sql, /elsif old.status = 'draft' then new.published_at = pg_catalog.statement_timestamp\(\)/);
assert.match(sql, /else new.published_at = old.published_at/);
assert.match(sql, /else new.published_at = null/);
assert.match(sql, /status = 'draft' and published_at is null/);
assert.match(sql, /status = 'published' and published_at is not null/);
assert.doesNotMatch(read('src/components/editorial-content.tsx'), /dangerouslySetInnerHTML/);
for (const route of ['k-contents', 'k-contents/music', 'k-contents/dramas', 'k-contents/movies', 'k-trends', 'k-trends/beauty', 'k-trends/fashion', 'k-trends/food']) assert.doesNotMatch(read(`src/app/${route}/page.tsx`), /mock-content|makeCards/);
console.log('PASS: offline validation, URL safety, write whitelist, authorization, stale/zero-row handling, public filters, draft failure behavior, RLS/grant and timestamp static checks. No network or database writes.');
