// Offline-only tests. All Supabase calls are mocked; never loads env or writes DB.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

function load(path, resolver) {
  const context = { exports: {}, require: resolver };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  return context.exports;
}

async function main() {
  let authenticated = true, available = true, past = false, closed = false, error = null;
  const writes = [];
  const applyClient = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'verified-member' } : null }, error: null }) },
    from(table) {
      if (table === 'events') return {
        select(fields) { assert.equal(fields, 'id,starts_at,application_deadline'); return this; },
        eq(k, v) { assert.ok((k === 'id' && v === 'route-event') || (k === 'status' && v === 'published')); return this; },
        async maybeSingle() { return { data: available ? {
          id: 'route-event', starts_at: new Date(Date.now() + (past ? -60000 : 60000)).toISOString(),
          application_deadline: closed ? new Date(Date.now() - 60000).toISOString() : null,
        } : null, error: null }; },
      };
      assert.equal(table, 'event_applications');
      return { insert: async (payload) => { writes.push(payload); return { error }; } };
    },
  };
  const { applyToEvent } = load('src/lib/apply-to-event.ts', (name) => name === 'server-only' ? {} : { createClient: async () => applyClient });
  authenticated = false; assert.equal((await applyToEvent('route-event')).loginRequired, true);
  authenticated = true; available = false; assert.equal((await applyToEvent('route-event')).ok, false);
  available = true; past = true; assert.equal((await applyToEvent('route-event')).ok, false);
  past = false; closed = true; assert.equal((await applyToEvent('route-event')).ok, false);
  assert.equal(writes.length, 0);
  closed = false; assert.equal((await applyToEvent('route-event')).ok, true);
  assert.deepEqual(Object.keys(writes[0]).sort(), ['event_id', 'member_id']);
  assert.equal(writes[0].member_id, 'verified-member');
  assert.equal(writes[0].event_id, 'route-event');
  error = { code: '23505', message: 'private' };
  assert.equal((await applyToEvent('route-event')).alreadyApplied, true);
  error = { message: 'private' };
  assert.equal((await applyToEvent('route-event')).ok, false);
  assert.ok(!(await applyToEvent('route-event')).message.includes('private'));

  let access = 'admin', found = true, updates = 0;
  let filters = [];
  const mutation = {
    eq(k, v) { filters.push([k, v]); return this; },
    select(s) { assert.equal(s, 'id'); return this; },
    async maybeSingle() { return { data: found ? { id: 'safe' } : null, error: null }; },
  };
  const { moderateApplication } = load('src/app/admin/event-applications/actions.ts', () => ({ getAdminAccess: async () => ({
    status: access, client: { from(table) {
      assert.equal(table, 'event_applications');
      return { update(payload) { assert.deepEqual(Object.keys(payload), ['status']); updates++; return mutation; } };
    } },
  }) }));
  const id = '00000000-0000-4000-8000-000000000001';
  for (access of ['unauthenticated', 'forbidden', 'unavailable']) assert.equal((await moderateApplication(id, 'approved')).ok, false);
  access = 'admin';
  for (const args of [['invalid', 'approved'], [id, 'pending'], [id, { role: 'admin' }]]) assert.equal((await moderateApplication(...args)).ok, false);
  assert.equal(updates, 0);
  for (const decision of ['approved', 'rejected']) {
    filters = []; assert.equal((await moderateApplication(id, decision)).ok, true);
    assert.deepEqual(filters, [['id', id], ['status', 'pending']]);
  }
  found = false; assert.equal((await moderateApplication(id, 'approved')).ok, false);

  const eventHelpers = load('src/lib/events.ts', () => ({}));
  let ownStatus = 'pending', privateReads = 0;
  const ownClient = { from(table) {
    if (table === 'event_applications') return {
      select(s) { assert.equal(s, 'id,event_id,status'); return this; },
      eq(k, v) { assert.equal(k, 'member_id'); assert.equal(v, 'verified-member'); return this; },
      async order() { return { data: [{ id: 'application', event_id: 'own-event', status: ownStatus }], error: null }; },
    };
    if (table === 'events') return {
      select(s) { assert.equal(s, 'id,title,starts_at,public_area'); return this; },
      in(k, ids) { assert.equal(k, 'id'); assert.equal(ids.join(','), 'own-event'); return this; },
      async eq(k, v) { assert.equal(k, 'status'); assert.equal(v, 'published'); return { data: [{ id: 'own-event', title: 'Event', starts_at: '2030-01-01T00:00:00Z', public_area: 'General area' }], error: null }; },
    };
    assert.equal(table, 'event_meeting_details'); privateReads++;
    return {
      select(s) { assert.equal(s, 'event_id,meeting_details'); return this; },
      async in(k, ids) { assert.equal(k, 'event_id'); assert.equal(ids.join(','), 'own-event'); return { data: [{ event_id: 'own-event', meeting_details: 'MOCK_PRIVATE' }], error: null }; },
    };
  } };
  const page = load('src/app/account/events/page.tsx', (name) => {
    if (name === 'react/jsx-runtime') return { jsx: (t, props) => ({ props }), jsxs: (t, props) => ({ props }) };
    if (name === '@/lib/events') return eventHelpers;
    if (name === '@/lib/event-request-time') return { eventRequestTime: async () => Date.now() };
    if (name === '@/lib/auth/require-user') return { requireUser: async () => ({ id: 'verified-member' }) };
    if (name === '@/lib/supabase/server') return { createClient: async () => ownClient };
    return {};
  });
  for (ownStatus of ['pending', 'rejected']) {
    assert.ok(!JSON.stringify(await page.default()).includes('MOCK_PRIVATE'));
  }
  assert.equal(privateReads, 0);
  ownStatus = 'approved'; assert.ok(JSON.stringify(await page.default()).includes('MOCK_PRIVATE'));
  assert.equal(privateReads, 1);

  const sql = fs.readFileSync('supabase/migrations/20260924010000_create_events_applications.sql', 'utf8');
  assert.equal(sql.split('$$').length - 1, 4);
  assert.ok(sql.includes('unique (member_id, event_id)'));
  assert.ok(sql.includes("a.member_id = (select auth.uid()) and a.status = 'approved'"));
  assert.ok(sql.includes('grant select (event_id, meeting_details) on public.event_meeting_details to authenticated'));
  assert.ok(!/grant[^;]*event_meeting_details[^;]*to anon/i.test(sql));
  assert.ok(!/alter table public\.(profiles|questions|answers|places|reviews|experiences)/i.test(sql));
  console.log('PASS: offline application eligibility/identity/payload, duplicate handling, admin denials, moderation filters, own-only private fetch, and SQL boundary checks. No real DB calls.');
}
main().catch(() => { console.error('FAIL: events offline security assertion'); process.exitCode = 1; });
