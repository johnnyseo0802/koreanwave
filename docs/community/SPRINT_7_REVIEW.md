# Sprint 7 review and deployment gate

**Finalization authorized (2026-09-29).** The operator confirms the final
sanitized-media migration is applied and the server-only media secret is configured
in Vercel Production. Commit/push is now authorized after final local verification.
Production member/admin Storage E2E remains a manual check after deployment;
local fixture tests are not a substitute for that check.
Migration: `supabase/migrations/20260928000000_community_participation.sql`.
No production UGC, users, buckets or schema were created by this work.

## Discovery and decisions

Existing questions/answers/reviews use one-way pending moderation, column grants,
server `getAdminAccess()` backed by verified Auth + private profiles.role, and
normal cookie clients. Existing Contact was informational only (no report table).
Existing site-media is intentionally public, admin-only, and remains untouched.
Proxy refresh and private/no-store responses remain unchanged.

New tables: community_posts, community_uploads, community_helpful,
community_reports and the singleton community_prompt. Upload registry is needed
to allocate a random, account-owned media namespace before submitting a post.
It prevents user UUIDs from appearing in public media URLs. Filenames are fixed
`<database-generated-upload-uuid>/image.webp`; original filenames are ignored.

Profiles stay private. No name snapshot, public profile query or directory is
introduced; public authors are intentionally anonymous. User-entered body text
is escaped plain text. Operators must moderate self-disclosed personal details.

No member edits/deletion after submission, including pending. Admins can only
approve/reject pending posts and feature/unfeature approved posts. No content
body editing through moderation; no timestamp write grants. Terminal publication
is immutable. Reports have one row per reporter/post and an open -> resolved
review workflow; reporter identity is not selectable. Resolving is not takedown.
An operational takedown/support process remains necessary before broad UGC launch.

## Storage and metadata

community-media is PRIVATE; RLS permits own/admin reads and reads attached to
approved posts. Unattached, pending and rejected photos are private to the owner
and administrators. All direct anon/authenticated Storage INSERTs are denied,
including admins. UPDATE and DELETE are denied, including cross-member writes.
Posts accept only already-uploaded images owned by the authenticated author.
One image can attach to only one post. No signed URLs are emitted or cached.

The app uses the normal cookie client for verified Auth, registry allocation and
own-only registry re-read. Only the upload-only `community-media-writer.ts` module
uses a separate server secret client, after those checks. It accepts no bucket or
path overrides, re-encodes before creating the client, stores only WebP with
upsert=false, and never exports the privileged client. Downloads keep using the
normal cookie client and existing approved/owner/admin RLS. Responses are
private, no-store. JPEG/PNG/WebP <=2 MiB input, maximum40M decoded pixels, no
animation, resize inside1600x1600, WebP output <=2 MiB. Sharp was already a Next
transitive dependency and is now explicitly pinned as a runtime dependency.
Sharp strips metadata by default; rotation is applied before re-encoding. Tests
verify actual EXIF removal, not just file signatures. References:
[Sharp output options](https://sharp.pixelplumbing.com/api-output/),
[Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control).

The application delivery route also re-encodes as defense in depth. Member API
bypass uploads are now denied at Storage RLS, regardless of declared MIME.
Only sanitized WebP is retained; member originals never enter Storage. Approved
objects may therefore be read anonymously; pending/rejected remain owner/admin
only. Privileged operators can bypass RLS: never manually upload originals into
this bucket. This draft assumes a new bucket; no old objects were backfilled.

### Server credential configuration (do not paste values into chat/source)

Required variable: `SUPABASE_COMMUNITY_MEDIA_SECRET_KEY`.
Use the current Secret key from Supabase Dashboard → Settings → API Keys.
Configure it privately in Vercel Project → Settings → Environment Variables for
the intended environments, and in ignored `.env.local` for local uploads. No real
value was inspected or configured. Missing configuration fails closed; build does
not need the secret. Do not prefix with NEXT_PUBLIC_. Use a separately named
Secret key for revocation/rotation; no dedicated reader identity or legacy JWT key.
The modern secret maps to the privileged service_role internally and bypasses RLS;
it is NOT bucket-scoped. The application wrapper narrows use, not the credential’s
actual privileges. Never reuse this module for DB queries, normal SSR or downloads.
Reference: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Failed submissions/abandoned uploads can leave private registry/object orphans.
There is no automated cleanup or per-user upload quota in this sprint. Before
open recruitment set retention, cost monitoring and abuse/rate-limit procedures.
Cleanup should use the Storage API after checking references, not SQL deletion of
storage.objects. Auth deletion cascades registry/posts but leaves physical objects
private and inaccessible; removing those files requires a separately reviewed
cleanup workflow. No self-service account deletion is added here.

## Narrow SECURITY DEFINER functions

All have empty search_path, fully qualified relations, no dynamic SQL, explicit
EXECUTE grants, and derive identity from auth.uid(), never a caller user ID.

- community_is_admin: boolean for current caller only, private profiles unchanged.
- community_owns_uploaded_image: caller ownership plus actual object existence.
- community_media_allowed: bucket path/read predicate; no profile output.
- community_can_help: approved, other-author predicate.
- community_helpful_counts: counts for at most60 approved post IDs; no voters.
- my_community_contributions: latest100 own rows across posts/questions/answers/
  reviews, no identity fields. Definer is necessary because old answer/review
  author_id column grants intentionally prohibit client filtering on that column.

These functions must be owned by a trusted migration owner. Do not grant function
creation/replacement privileges to API users. They are not service-key flows.

## Bounds and UX

Feed reads up to30 per source, merges newest first and renders30. Home reads6
featured, or bounded approved fallback, shows3. Admin queue max50, own history
max100. No N+1 author lookups. Count RPC is one detail aggregate, no public votes.
Helpful is login-only, unique(post_id,member_id), no own-post vote; desired-state
mutation avoids toggle retries reversing a prior success. Form ref locks prevent
repeat clicks; successful submissions replace the form. Ambiguous network failures
instruct users to check history; there is no cross-device text idempotency token.

## DB verification checklist (retained from migration review)

Run the entire transaction in a disposable Supabase environment first. No SQL was
executed by this sprint. Static tests are NOT an RLS execution proof.

1. Inspect RLS/grants/functions on all five new tables; confirm no PUBLIC grants.
2. Anon: read approved only; no posts/uploads/votes/reports/mutations/private photos.
3. Member A: create own upload through app only; direct Storage INSERT must fail;
   force author/status/feature/time columns ->deny.
4. Member B: cannot attach/read A private media, read A pending/rejected posts,
   access A history, overwrite/delete A files, or execute moderation.
5. Admin: pending approve/reject succeeds; repeat decision affects zero rows;
   feature only approved; all private profile information still restricted.
6. Public: private/missing post URLs indistinguishable; pending/rejected media
   download denied, approved sanitized image decodes without EXIF/GPS. Reject
   cross-member namespace fields, malformed images, unsupported MIME and >2 MiB.
7. Helpful: own/pending/rejected denied, duplicate unique violation, own removal
   succeeds, no other voter identity SELECT; counts hide private posts.
8. Reports: own insert against approved only, duplicate denied, no member read,
   admin open->resolved only, raw errors hidden; establish escalation process.
9. Prompt singleton: anon/member writes denied, admin create/update works.
10. Regression: site-media still admin-only, editorial drafts private, event exact
    meeting details available only to approved own participants, existing queues.

Read-only catalog checks can use pg_policies, information_schema.column_privileges,
pg_get_functiondef and pg_get_triggerdef. Confirm bucket public=false and limits.
Do not test with production posts/accounts. Human applies reviewed migration,
then manual member/admin E2E, then separately authorize deployment.

## Rollback planning

Disable new app entry points first. Do not blindly drop objects: preserve member
content, reports and media according to an approved retention/export plan.
Revoke new API grants/EXECUTE and remove only named new Storage policies if
disabling access. Keep existing Sprint1–6 objects intact. Never delete a bucket’s
metadata while objects remain. A destructive rollback requires separate approval.

## Local verification record

- `pnpm lint`: PASS.
- `pnpm build`: PASS (normal `.next`; no EPERM fallback/config changes needed).
- Existing security suites: site-security, editorial-security, events-security,
  ssr-auth-security, discovery-security: PASS.
- community-security: PASS; actual in-memory Sharp EXIF test, mocked server
  actions/storage denial/delivery and SQL/source boundary checks. No live DB RLS.
- Sanitized-media revision: community-media-security PASS; authenticated app upload
  stores only re-encoded WebP, own-registry recheck and injected destinations denied,
  oversized/unsupported/malformed input denied, missing secret fails closed, and
  EXIF/GPS-bearing fixture loses metadata. Anonymous/member direct INSERT denial
  is SQL-static; pending/rejected/approved/owner/admin reads use a policy-model mock,
  not a live PostgreSQL proof. Existing five suites, lint and build rerun PASS.
- community-browser: PASS with local-only mock Supabase + built Next server at
  375/768/1440px. Public feed types/detail/private404, anonymous redirects,
  member admin denial, chooser/forms/photo preview, Helpful/report controls,
  contributions and six admin tabs. No horizontal overflow or runtime errors.
- Existing discovery-browser: PASS,20 public routes at all three sizes and
  admin layouts. No production network calls/writes or fake production users.
- Screenshots are ignored build artifacts under `.next/community-qa`.
- Original review ended with a clean whitespace check and no commit/push or remote
  migration execution by the agent. The operator subsequently confirmed migration
  application and authorized code finalization; see the status at the top.
