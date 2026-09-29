// Explicit opt-in, read-only production probes. No Auth session/secret is used.
// Prints only probe labels, status codes and counts, never response bodies or URLs.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (process.env.RUN_COMMUNITY_READONLY !== '1') throw new Error('Explicit read-only opt-in required');
createRequire(require.resolve('next/package.json'))('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) { console.log('Environment: UNAVAILABLE'); process.exit(1); }
const headers = { apikey: key, Authorization: `Bearer ${key}` };
async function probe(label, path, init = {}) {
  try {
    const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => null);
    const safeCode = typeof data?.code === 'string' && /^[A-Z0-9_]{1,30}$/i.test(data.code) ? data.code : undefined;
    console.log(JSON.stringify({ probe: label, http: response.status, code: safeCode, rows: Array.isArray(data) ? data.length : undefined }));
    return { ok: response.ok, data };
  } catch { console.log(JSON.stringify({ probe: label, result: 'NETWORK_UNAVAILABLE' })); return { ok: false }; }
}
console.log('Environment: AVAILABLE (publishable client only)');
for (const table of ['community_uploads','community_posts','community_helpful','community_reports','community_prompt']) {
  await probe(`schema/${table}`, `/rest/v1/${table}?select=${table === 'community_helpful' ? 'post_id' : 'id'}&limit=1`);
}
for (const status of ['pending','rejected','approved']) {
  await probe(`posts/${status}`, `/rest/v1/community_posts?select=id&status=eq.${status}&limit=1`);
}
for (const [table,field] of [['community_posts','author_id'],['community_uploads','owner_id'],['community_helpful','member_id'],['community_reports','reporter_id']]) {
  await probe(`identity/${table}`, `/rest/v1/${table}?select=${field}&limit=1`);
}
// SELECT-only function, no arguments/identity and no mutation side effects.
await probe('own-contributions/anonymous', '/rest/v1/rpc/my_community_contributions', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
await probe('helpful-counts/anonymous', '/rest/v1/rpc/community_helpful_counts', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{"targets":[]}' });
await probe('storage-read-predicate/signature', '/rest/v1/rpc/community_media_allowed', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{"object_name":"00000000-0000-0000-0000-000000000000/image.webp"}' });
await probe('storage/community-media', '/storage/v1/bucket/community-media');
// Fixed nonexistent path; never uploads or enumerates private object names.
const missing = await probe('storage/missing-object', '/storage/v1/object/authenticated/community-media/00000000-0000-0000-0000-000000000000/image.webp');
if (!missing.ok && missing.data) console.log('Storage error category: '+(String(missing.data.message).toLowerCase().includes('bucket not found')?'BUCKET_NOT_FOUND_OR_HIDDEN':'OBJECT_DENIED_OR_ABSENT'));
const images = await probe('public-image-fields', '/rest/v1/community_posts?select=image_id&status=eq.approved&image_id=not.is.null&limit=3');
if (images.ok && Array.isArray(images.data) && images.data.length) {
  const sharp = (await import('sharp')).default;
  for (const row of images.data) {
    if (typeof row.image_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.image_id)) continue;
    try {
      const response = await fetch(`${url}/storage/v1/object/authenticated/community-media/${row.image_id}/image.webp`, { headers, signal:AbortSignal.timeout(15000) });
      if (!response.ok) { console.log('Approved image: READ_FAILED'); continue; }
      const bytes = Buffer.from(await response.arrayBuffer());
      const m = await sharp(bytes, {limitInputPixels:40000000}).metadata();
      console.log(JSON.stringify({probe:'approved-image',webp:m.format==='webp',metadataAbsent:!m.exif&&!m.xmp&&!m.iptc&&!m.icc,withinSize:bytes.length<=2097152}));
    } catch { console.log('Approved image: UNVERIFIED'); }
  }
} else console.log('Approved image: MANUAL_E2E_REQUIRED (no accessible fixture)');
for (const table of ['questions','answers','reviews']) for (const status of ['pending','rejected']) await probe(`regression/${table}/${status}`,`/rest/v1/${table}?select=id&status=eq.${status}&limit=1`);
for (const table of ['editorial_articles','places','experiences','events']) await probe(`regression/${table}/draft`,`/rest/v1/${table}?select=id&status=eq.draft&limit=1`);
for (const table of ['profiles','event_applications','event_meeting_details']) await probe(`regression/${table}/private`,`/rest/v1/${table}?select=${table==='event_meeting_details'?'event_id':'id'}&limit=1`);
for (const path of ['/community','/write/moment','/account/contributions','/admin/community','/community/media/00000000-0000-0000-0000-000000000000']) {
  try {
    const r=await fetch(`https://koreanwave-kappa.vercel.app${path}`,{redirect:'manual',signal:AbortSignal.timeout(15000)});
    const html=await r.text();
    console.log(JSON.stringify({probe:`deployment${path}`,http:r.status,loginRedirect:(r.headers.get('location')??'').startsWith('/login'),sprint7Feed:html.includes('See Korea through the people who live here and love it.'),notFound:r.status===404}));
  } catch { console.log(JSON.stringify({probe:`deployment${path}`,result:'NETWORK_UNAVAILABLE'})); }
}
console.log('No production rows, users, prompts, votes, reports or files created/modified/deleted.');
