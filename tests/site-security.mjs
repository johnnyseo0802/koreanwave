// Static/offline regression only. Does not load .env, log secrets or contact a DB.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => fs.readFileSync(path, 'utf8');
const load = (path, imports = {}) => {
  const context = { exports: {}, require: name => name === 'server-only' ? {} : imports[name] };
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
};
const { safeNextPath } = load('src/lib/auth/safe-next-path.ts');
for (const path of ['/account', '/write', '/community/questions/abc', '/event/abc', '/admin/content']) assert.equal(safeNextPath(path), path);
for (const path of ['https://external.org', '//external.org', '/\\external.org', '/%2f%2fevil', '/a/../evil', '/a?next=evil', '/a#evil', 'javascript:alert(1)', '/\nevil']) assert.equal(safeNextPath(path), '/');

const publicQueries = [
  ['src/app/community/questions/page.tsx', 'approved'],
  ['src/app/community/questions/[id]/page.tsx', 'approved'],
  ['src/components/public-answers.tsx', 'approved'],
  ['src/components/public-reviews.tsx', 'approved'],
  ['src/components/local-content.tsx', 'published'],
  ['src/components/home-events.tsx', 'published'],
  ['src/lib/editorial-data.ts', 'published'],
  ['src/app/events/page.tsx', 'published'],
  ['src/app/event/[id]/page.tsx', 'published'],
];
for (const [path, status] of publicQueries) {
  const code = read(path);
  assert.ok(code.includes(`.eq("status", "${status}")`), path);
  for (const select of code.matchAll(/\.select\("([^"]+)"\)/g)) assert.ok(!select[1].includes('author_id'), `${path}: no public author selection`);
}
assert.match(read('src/components/public-reviews.tsx'), /eq\("places.status", "published"\)/);
const home = read('src/components/home-events.tsx');
assert.match(home, /\.limit\(3\)/);
assert.doesNotMatch(home, /from\("(?:profiles|event_applications|event_meeting_details)"\)/);
const myEvents = read('src/app/account/events/page.tsx');
assert.match(myEvents, /\.eq\("member_id", user.id\)/);
assert.match(myEvents, /row.status === "approved" && events.has\(row.event_id\)/);
assert.match(myEvents, /\.in\("event_id", approved\)/);

for (const area of ['questions', 'answers', 'reviews', 'event-applications']) {
  const page = read(`src/app/admin/${area}/page.tsx`);
  const action = read(`src/app/admin/${area}/actions.ts`);
  assert.match(page, /await getAdminAccess\(\)/);
  assert.match(page, /access.status !== "admin"\) notFound\(\)/);
  assert.match(action, /await getAdminAccess\(\)/);
  assert.match(action, /access.status !== "admin"/);
  assert.match(action, /if \(!data\)/);
}
let role = 'member';
const mock = { auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }) }, from: name => {
  assert.equal(name, 'profiles');
  return { select: column => { assert.equal(column, 'role'); return { eq: (key, value) => { assert.equal(key, 'id'); assert.equal(value, 'verified-user'); return { maybeSingle: async () => ({ data: { role }, error: null }) }; } }; } };
} };
const { getAdminAccess } = load('src/lib/auth/admin-access.ts', { '@/lib/supabase/server': { createClient: async () => mock } });
assert.equal((await getAdminAccess()).status, 'forbidden');
role = 'admin'; assert.equal((await getAdminAccess()).status, 'admin');

function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
for (const path of walk('src').filter(p => /\.(ts|tsx)$/.test(p))) {
  const code = read(path);
  assert.doesNotMatch(code, /console\.(?:log|error|warn|debug)\(/, `${path}: no production diagnostics`);
  assert.doesNotMatch(code, /\.select\(["']\*["']\)/, `${path}: no SELECT *`);
  assert.doesNotMatch(code, /dangerouslySetInnerHTML|SUPABASE_SERVICE_ROLE|sb_secret_/, `${path}: no elevated key/unsafe HTML`);
  assert.doesNotMatch(code, /(?:sb_publishable_|eyJhbGci)[A-Za-z0-9_.-]{20,}/, `${path}: no hardcoded credential`);
}
console.log('PASS: safe redirects, public status/identity filters, own approved-only meeting detail scope, live-role admin checks, guarded moderation actions, source secret/debug scan. Static/mock checks only.');
