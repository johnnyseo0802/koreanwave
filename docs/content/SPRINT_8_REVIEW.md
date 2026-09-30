# Sprint 8 implementation review — remote changes NOT authorized

## Deployment gate

Review the single forward-only migration `supabase/migrations/20260929000000_content_clusters.sql`.
Do not apply it automatically, rerun older migrations, seed production, upload
images, commit, push or deploy as part of Phase 1. There is no import/seed command.
Missing schema produces safe unavailable/404 states; existing content continues.

## Model and privacy

Three tables: content_clusters, content_cluster_items, content_cluster_prompts.
Six nullable real FKs plus exactly-one CHECK; six partial unique indexes enforce
one copy of a target in a cluster. No arbitrary target table input. Public RLS
requires both published cluster and independently published/approved target.
Own pending records that existing UGC RLS permits are NOT public relationships.
Admin policies query the verified caller's private profiles.role. Restricted
column grants exclude IDs/timestamps; only link/prompt rows can be deleted.
No existing UGC, event applications, meeting details or Storage policies change.
Places/Experiences gain admin-only column INSERT + RLS; Events do not.

The public DAL rechecks target status through PostgREST inner joins even when the
viewer is an admin. It never serializes raw relationship records, hidden counts,
private target UUIDs, profile identities or meeting details. Public detail/metadata
and related lists filter published clusters. Admin preview is independently gated,
is noindex and displays public targets only, including when the cluster is a draft.
Publishing a cluster updates only the cluster, never any connected target.

Existing article timestamp function is reused, not changed: published edits retain
publication date; unpublish clears it; republish gets a new date. Slug changes
change the public URL; there is no redirect history. Prefer permanent slugs.
All auth uses normal cookie clients and existing getAdminAccess/requireEditorialAdmin.
No new secret, service client, auth role or permission for regular members.

## Operator workflow and bounds

1. Reconcile private admin inventory against manifest; find existing item first.
2. Create/edit article or Place/Experience; save draft. Event editing unchanged.
3. Verify facts/rights; upload prepared image and alt text; use article preview.
4. In `/admin/clusters`, create a draft topic and connect existing content.
5. Lower display order appears first within each type; duplicate connection fails.
6. Add editorial questions/participation ideas, not fake member records.
7. Preview topic; separately publish verified targets, then publish the cluster.
8. Homepage selects first four published clusters by display order. Use that order
   to curate homepage selections; no new featured flag/metrics.
9. Set the weekly Community prompt separately using existing admin tools.
10. Distribute safe public URLs after deployment and confirmed publication.

Public: 40 clusters, 24 links/type/topic, 20 prompts, 3 related clusters with 4
cards each. Admin: 100 candidates/type, 200 links/topic, 100 prompts. No hidden
target counts displayed. These bounds suit initial inventory; add pagination
before growing beyond them. Simultaneous cluster text edits use updated_at
optimistic concurrency. Row-level link/prompt edits are last-write-wins; reload
before editing in another tab. Zero-row/duplicate writes show generic feedback.

## Founding members

`/founding-members` uses personas, not privileges: Local Tip, Traveler question/
Story, Fan Story. Existing login supports mission return paths. Signup keeps its
proven email confirmation flow: invitation explains confirm email, return to the
page, then choose mission. No fake automatic onboarding email or changed callback.
Helpful/Featured remain content recognition. No directory, ranks or new roles.

## Content inventory and verification

`sprint-8-manifest.json`: 74 unique planned assets, 16 EXISTING, 10 EXISTING_DRAFT,
48 NEW; all 74 NEEDS_VERIFICATION, 45 NEEDS_IMAGE. One existing article has an
image but its rights still need review. Ten cluster hubs are counted separately.
Existing published data was read in Phase 0; this phase does not query private
drafts or claim the inventory is current forever. Reconcile by exact title and
then record the existing UUID through authorized admin tooling; never recreate
an existing record because manifest IDs are null. Local draft provenance is an
exact title in Sprint 6 JSON. Remaining 14 drafts stay in backlog.

Of 18 Ask a Local assets, only one is an existing question (genuine-use review
required); 17 are editorial ideas. Ten participation prompts are not UGC either.
No invented Reviews/Answers/Moments/Stories, user accounts or author attribution.
No hours, prices, addresses or event confirmations are fabricated. Place candidates
and self-guided Experience ideas are NOT researched venue recommendations/bookings.

Priority 1: Seongsu, Mangwon, First Trip. All three are structurally prepared,
NOT launch-ready: verify content, rights, images and real organizer availability.
Do not auto-publish or roll the four October 2026 event dates forward.

`sprint-8-verification.json` records source/date/verifier/recheck/uncertainty and
rights/consent for every asset. Add one claim entry per independently checkable
claim. Use official venue/operator/institution sources; preserve evidence and
access dates. No personal contact information, credentials or private event
instructions in repository records. Verifier can be an editorial role label.

Lifecycle: Brief → Draft → Fact review → Rights review → Preview → Human publish.
Check volatile details immediately before publication, revisit at most every
30 days or sooner where needed; event schedule at recruitment and before event.
Omit uncertain details or direct visitors to official current information.
`editorial_articles.source_url` is a reader link, not the complete review record.
READY_TO_PUBLISH classification requires all four verification approval booleans
and human evidence review; it never triggers DB publication. Image-free editorial
prompts may mark rights as not applicable with a reason. No automated publishing.

## Media hardening

Admin site-media upload now decodes/re-encodes using the existing Sharp sanitizer:
JPEG/PNG/WebP ≤2 MiB, 40Mpixel ceiling, no animation, rotation, ≤1600×1600 WebP,
output ≤2 MiB; metadata dropped. Auth + admin role before processing, same-origin,
server-generated `images/<uuid>.webp`, upsert=false, reject caller path/bucket.
Only sanitized bytes go to Storage through normal admin session/RLS. Public
site-media delivery and earlier image URLs continue; no migration/backfill.
This hardens the APPLICATION upload path; privileged operators/admin direct
Storage access can still upload outside it. Existing images are not retrospectively
sanitized. Review them before reuse; never put private/embargoed material in a
public bucket, even attached to drafts. Community-media remains separate/private
and keeps its existing secret-isolated sanitized writer and owner/admin/public RLS.

## AI + video workflow

AI may propose briefs, drafts, titles, summaries, future translation, transcript
repurposing, social copy and existing related-item candidates. Human verifies and
publishes. Never invent visits, quotations, recommendations or citations. No AI
API/automatic publishing/marketing database added.

Pilot: *Beyond the Screen: A Seongsu Afternoon* — planning only, not filmed.
Original authorized video → short edits → reviewed article → `/explore/seongsu`
→ verified Place/Experience → real question → Moment prompt → social distribution.
Get filming/photo/music permissions; separate consent for redistributing UGC.
Use existing safe HTTPS source/attribution link for a video where appropriate;
no video host/upload or untrusted HTML embed. Normal site URLs accept UTM query
parameters. Suggested external link:
`/explore/seongsu?utm_source=youtube&utm_medium=video&utm_campaign=beyond_the_screen_seongsu&utm_content=episode_01`
Do not include personal identifiers. Canonical topic URL excludes UTMs. Public
link does not exist until topic is actually published; no fake video URL seeded.

## Review/testing and rollback

Run existing five security suites, Sprint 7 security/media, new clusters-security
and site-media-security, lint/build, clusters/community/discovery browser suites.
All tests use local mocks; no SQL executed. Static RLS inspection/model tests do
NOT constitute PostgreSQL role execution. Before remote application, run isolated
DB role tests: anon/member/admin, six private target types linked to published
cluster, unpublish hides relationship, duplicate/FK/check failures, timestamp
forgery, local member INSERT denial, admin creation, Event creation still denied.
After approval/application, manually verify with operator-controlled sessions.
No production fixture writes or secret is needed for local verification.

Rollback: disable new app entry points first; preserve data. Separately review
revocation of new grants/policies if needed. No automatic DROP, bucket cleanup or
changes to prior migrations. No new package or environment variable required.

## Final local verification — 2026-09-30

- pnpm lint and normal production pnpm build: PASS. No distDir workaround.
- Existing site/editorial/events/SSR/discovery security suites: PASS.
- Sprint 7 community and community-media security suites: PASS.
- clusters-security: PASS (static migration + executable DAL/actions mocks).
- site-media-security: PASS (real Sharp EXIF/GPS fixture and mocked Storage).
- clusters-browser: PASS at 375/768/1440px, public/detail/search/related/founding,
  admin list/editor/preview/local-create, member denial, anonymous login redirects,
  private/missing not-found, hidden empty sections, no horizontal overflow/errors.
  Fixtures deliberately expose private targets to the query layer so app filters
  must remove them, also when the viewer is an admin. Initial test ran an assertion
  before streamed content arrived; explicit content-readiness waits fixed the test.
- community-browser and discovery-browser: PASS at all three sizes; the latter
  includes 20 public routes plus admin layouts. No production calls/submissions.
- Mobile public and desktop preview screenshots visually inspected. Screenshots
  remain ignored under `.next/clusters-qa`; no screenshots committed.
- .env.local remains ignored, no secret variable in built static client chunks.
- No remote SQL/Storage/production content writes, commit, push or deployment.

These are not live PostgreSQL RLS tests; remote migration review and isolated-role
verification still precede operator-controlled E2E. Existing site-media originals
are not backfilled. First three launch clusters remain unverified content briefs.

## Changed-file inventory

New:
- supabase/migrations/20260929000000_content_clusters.sql
- src/lib/clusters.ts
- src/lib/cluster-data.ts
- src/components/cluster-content.tsx
- src/components/cluster-admin.tsx
- src/app/explore/page.tsx
- src/app/explore/[slug]/page.tsx
- src/app/founding-members/page.tsx
- src/app/admin/clusters/page.tsx
- src/app/admin/clusters/new/page.tsx
- src/app/admin/clusters/[id]/page.tsx
- src/app/admin/clusters/[id]/preview/page.tsx
- src/app/admin/clusters/actions.ts
- src/app/admin/local-content/[kind]/new/page.tsx
- docs/content/sprint-8-manifest.json
- docs/content/sprint-8-verification.json
- docs/content/SPRINT_8_REVIEW.md
- tests/clusters-security.mjs
- tests/site-media-security.mjs
- tests/clusters-browser.mjs

Modified:
- src/app/admin/local-content/actions.ts
- src/app/admin/media/upload/route.ts
- src/app/articles/[id]/page.tsx
- src/app/page.tsx
- src/app/search/page.tsx
- src/components/admin-moderation-nav.tsx
- src/components/local-content.tsx
- src/components/managed-content-admin.tsx
- src/components/managed-content-form.tsx
- src/lib/discovery-data.ts
- tests/discovery-security.mjs (cluster search expectations + real valid image fixture)
