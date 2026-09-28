# Sprint 6 — review before deployment

## Deployment gate

Remote migration: APPLIED by the operator, confirmed on 2026-09-28:
`supabase/migrations/20260927000000_site_media_discovery.sql`.
No additional migration is required. The applied SQL file is retained unchanged.
Read-only production checks confirm all four content tables' image columns are
queryable. This task executed no remote SQL, uploads or production row mutations.

Repository discovery: only editorial_articles had image_url. No Storage bucket or
policy was defined in migrations; remote bucket inventory has not been independently
verified through an admin session. The public site-media endpoint responds with
object-not-found (not bucket-not-found) for a missing object. The migration creates
the bucket without silently replacing an existing bucket. No referenced first-party
images were available for a real public-file delivery check at finalization.

## Migration scope / review

- Add nullable image_url to places, experiences, events; image_alt to all four
  content tables. Existing rows remain unchanged. Existing area/category fields
  supply filters; no new taxonomy, search engine or redundant content table.
- Reuse existing publication/timestamp triggers. Narrow admin UPDATE grants and
  SELECT/UPDATE policies allow maintaining existing places/experiences/events.
  No INSERT/DELETE workflow or schedule editing. No writes to protected timestamps.
- Publication retains original publication time on edits, clears it on draft, and
  sets a new time on republish using the existing triggers. Unpublishing a place
  hides public reviews; unpublishing an event hides meeting details via existing
  RLS. Coordinate editorial changes with pending applications/moderation.
- Storage: public site-media bucket, JPEG/PNG/WebP, maximum 2 MiB. Only verified
  admins can upload/change/delete. Restrictive write guards prevent other permissive
  policies from granting members access to this bucket. Anonymous guards do not
  query private profiles. Other buckets keep their own policies.
- Public bucket delivery needs no global object SELECT policy. Admin SELECT enables
  object management. Review any existing broad SELECT policies separately.
- Private profiles, Auth, community moderation, applications and private meeting
  policies are unchanged. No role bootstrap, seeds or user creation.

Official architecture references:
[Storage access controls](https://supabase.com/docs/guides/storage/security/access-control)
and [bucket restrictions](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

## Media workflow

1. Use only owned or independently verified licensed images, without personal
   information, private meeting points or embargoed content. A draft article is
   private but its image in this public bucket is NOT private.
2. Prepare a 16:9 raster image, ideally about 1600×900, under 2 MiB. Strip GPS/EXIF
   metadata before upload; this MVP does not promise metadata sanitization. Avoid
   unusually large pixel dimensions. Use still images; no SVG or arbitrary hosts.
3. In the admin editor upload a file and describe it in the accessibility field.
   The server rechecks admin identity, request origin, byte count, declared MIME
   and raster signature. Storage independently enforces role/type/size/path rules.
   The signature check is not antivirus scanning or complete image decoding.
4. The server generates a random UUID path; original filenames are ignored.
   Replacements always create new objects with upsert disabled.
5. Save the content to attach the image. Removing detaches it after Save, without
   deleting a possibly shared asset. Abandoned/replaced uploads remain in Storage.
   An authorized operator can remove confirmed-unused objects through Storage
   management later; no automatic garbage collection or deletion UI is included.
6. First-party Supabase project host + dedicated public path are allowlisted in
   Next Image. No wildcard hostname, redirects, SVG proxy or arbitrary external
   image fetching. Missing, untrusted or failed images get the branded fallback.
   Previously stored external editorial image URLs are not fetched; remove/replace
   them before saving an older article. Source attribution links remain separate.

## Admin content scope

- /admin/content: existing create/edit/publish/draft/preview, now with image upload.
- /admin/local-content: edit existing Places and Experiences, including public
  content, image and publication state. Existing six/four entries are not rewritten.
- /admin/events: edit existing public event text/image/status. Dates, private meeting
  instructions and participant applications are deliberately outside this editor.
- Every page/action rechecks verified user and protected profiles.role. Updates
  whitelist fields and require id + saved updated_at. Zero returned rows is a conflict.
- Upload route uses the normal authenticated cookie client and Storage RLS. No
  service credentials. Actual permission behavior must be verified after migration.

## Discovery / performance

Search covers published editorial title/summary/category and local name/description/
area/category only. Query terms are capped at 80 code points and stripped of
PostgREST/LIKE grammar. Values never become SQL. Three parallel bounded queries,
20 results each. No private tables/identities, no wildcard SELECT. No search index
required for dozens of records; assess query plans before scaling. Search is noindex.

Local filters use URL area/category values from the latest 100 published entries;
categories use existing routes. Article lists show at most 60 latest publications.
These caps should become proper pagination when inventory exceeds MVP scale.
Home has six bounded content queries: two editorial, two local, questions, events.
Sections fail independently. Question previews use approved content without authors.
Root dynamic rendering, SSR Proxy and private/no-store behavior are preserved.

Metadata queries explicitly filter published content. Canonicals use the deployed
Vercel origin supplied for this sprint, not an invented domain. Update the centralized
origin when the operator chooses a domain. Social images use approved first-party
media or a generated brand card. No private meeting data enters metadata.

## Content preparation

`docs/content/sprint-6-editorial-drafts.json` contains 24 original English draft
entries: four each for Music, Dramas, Movies, Beauty, Fashion, Food. Each includes
title, summary, body and an image subject/alt/aspect-ratio plan. This is an admin-entry
dataset, NOT an import script. Do not copy image_plan into the DB payload.

Operator: review text, enter through the CMS, obtain image permissions, upload and
preview, then publish deliberately. No licensing is assumed. No fake review, quote,
current entertainment news, opening-hours or pricing claim is supplied. Keep the
existing six Places/four Experiences; validate current practical details manually.
Keep existing events and verify their October 2026 schedules with the organizer;
do not automatically roll dates forward or present unconfirmed gatherings as facts.

SMTP and custom domain configuration remain intentionally deferred and untouched.

## Verification / next action

Run lint/build and `node tests/{site,editorial,events,ssr-auth,discovery}-security.mjs`
(expand each filename; PowerShell does not expand brace notation).
`tests/discovery-browser.mjs` runs a temporary production server with localhost-only
fixture API, populated public content and a fake verified admin. It never submits
forms/uploads or contacts production; Playwright uses an isolated browser context.
Check screenshots under ignored `.next/discovery-qa`.

Production follow-up: using operator-controlled accounts, verify member/admin
Storage permissions, upload/replace/detach and stale edit. Verify private meeting
details for pending, rejected, unrelated and approved participants. Anonymous
private-table denial was checked remotely. No authenticated production session was
used by this task; offline tests are not proof of remote member/admin enforcement.
Do not rerun the applied migration. Migration review no longer blocks the requested
commit/push; actual media delivery/upload E2E remains an operator follow-up.

Rollback: revert application deployment first. Do not blindly drop columns, bucket
or media; retain data for review. Revoke only the new column grants and remove only
the new named policies if necessary. Use Storage API for object removal, not direct
SQL DELETE against storage.objects. No executable destructive rollback is supplied.

## Changed-file inventory

Verification on 2026-09-27: pnpm lint PASS; pnpm build PASS; site, editorial,
events, SSR/auth and discovery security suites PASS. Initial build hit sandbox
worker spawn EPERM, resolved by allowing the build process; no temporary distDir
or project configuration override was needed. Browser fixtures: 20 populated
public routes at 375/768/1440px, search/filters, image decoding/cropping/failure
fallback, canonical/OG metadata, draft/missing 404, anonymous admin redirects and
three admin forms at all widths PASS. No horizontal overflow or runtime errors.
This original verification did not claim remote RLS enforcement or Storage E2E.
Finalization on 2026-09-28 reran lint/build and all five security suites successfully.
Read-only production checks passed: published queries (1 article, 6 places,
4 experiences, 4 events); zero anonymous draft/pending/rejected results; anonymous
profiles/applications/meeting-detail denial; public-only search queries. No existing
site-media image was linked by these rows, so file delivery remains unverified.
No production upload was attempted, including negative tests that could create a
file if permissions were misconfigured. Anonymous/member upload denial and admin
upload authorization have static/mock coverage, not a real Storage write test.
An empty anonymous POST to the local application's upload route returned 403;
no file was supplied and Storage was not written. Production-backed local public
places/experiences/search/home requests returned HTTP 200 without unavailable states.
Vercel compatibility: standard Next.js build and Proxy passed with no output or
environment changes. Vercel's post-push deployment status must be checked separately.
Real-data browser verification initially timed out on Next.js background RSC
prefetch for filter links, despite HTTP 200 and complete visible content. The
existing browser test now uses document load + UI assertions, and explicitly waits
for streamed login redirects. No product/auth behavior changed for this adjustment.
[Playwright navigation readiness](https://playwright.dev/docs/api/class-page#page-goto-option-wait-until).
Final browser results: real-data anonymous suite PASS at 375/768/1440px (25 public
routes, protected redirects, missing pages and available public details). K-Trends
detail skipped because no public item exists. Sprint 6's populated local fixture
suite PASS for all content types, image delivery/fallback, metadata and admin forms.
Both browser suites created no production rows/files and used no real login.

- `next.config.ts`
- `src/app/admin/content/actions.ts`
- `src/app/articles/[id]/page.tsx`
- `src/app/event/[id]/page.tsx`
- `src/app/events/page.tsx`
- `src/app/layout.tsx`
- `src/app/local-korea/experiences/[id]/page.tsx`
- `src/app/local-korea/experiences/page.tsx`
- `src/app/local-korea/places/[id]/page.tsx`
- `src/app/local-korea/places/page.tsx`
- `src/app/page.tsx`
- `src/components/admin-moderation-nav.tsx`
- `src/components/editorial-content.tsx`
- `src/components/editorial-form.tsx`
- `src/components/home-events.tsx`
- `src/components/local-content.tsx`
- `src/components/site-header.tsx`
- `src/lib/editorial-data.ts`
- `src/lib/editorial.ts`
- `src/lib/events.ts`
- `tests/editorial-security.mjs`
- `tests/site-browser.mjs`
- `docs/SPRINT_6_REVIEW.md`
- `docs/content/sprint-6-editorial-drafts.json`
- `src/app/admin/events/[id]/page.tsx`
- `src/app/admin/events/page.tsx`
- `src/app/admin/local-content/[kind]/[id]/page.tsx`
- `src/app/admin/local-content/actions.ts`
- `src/app/admin/local-content/page.tsx`
- `src/app/admin/media/upload/route.ts`
- `src/app/opengraph-image.tsx`
- `src/app/search/page.tsx`
- `src/components/content-image.tsx`
- `src/components/discovery-cards.tsx`
- `src/components/home-discovery.tsx`
- `src/components/managed-content-admin.tsx`
- `src/components/managed-content-form.tsx`
- `src/components/media-input.tsx`
- `src/lib/discovery-data.ts`
- `src/lib/discovery.ts`
- `src/lib/managed-content.ts`
- `src/lib/media.ts`
- `src/lib/public-metadata.ts`
- `supabase/migrations/20260927000000_site_media_discovery.sql`
- `tests/discovery-browser.mjs`
- `tests/discovery-security.mjs`
