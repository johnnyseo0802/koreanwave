# Launch Phase 1A — Seongsu pre-shoot review pack

## Current handoff — 2026-10-03

The historical preparation record below is retained, not a current claim that
the privacy migration is still unapplied. The operator reports Production
application and successful anonymous/authenticated column-grant and UI checks.
No remote migration is performed by this task. The operator explicitly confirmed
that the reviewed revised SQL was applied without modification, including no
identity RPC or new SECURITY DEFINER function. The provenance gate is cleared
on that operator attestation, not an independent remote SQL-text comparison.
See `finalization-review.md` for the local hash and rerun results.

`first-publication-batch.md` is the latest edited four-asset handoff, including
complete claim mapping, rechecked sources, public inventory, SEO/link plan,
image-generation briefs, cluster settings and the current Admin UI's limits.
It supersedes the corresponding four original manuscripts for editorial review;
the other three drafts and video/shoot plans remain unchanged. Nothing published.

Prepared 2026-10-02 (Asia/Seoul). Sprint 8 is closed. This is local editorial
preparation plus one privacy migration draft, not a new product sprint.
No import/seed/publishing script. No media generated, downloaded or uploaded.
No production writes, Auth changes, Storage changes, commit or push authorized.

## Audit performed before implementation

Inspected Sprint 6 drafts, Sprint 8 manifest/verification, cluster DAL/admin,
all application questions queries and migrations. Queried only published public
inventory using publishable credentials without an authenticated session.

Snapshot: six Places, four Experiences, one editorial article, zero visible
published clusters. These are visible counts, not a claim that no private draft
exists. An operator must reconcile private admin inventory before any creation.

Reuse rather than recreate:
- Existing Place **Seongsu**: `/local-korea/places/94844f11-6e7c-4a1b-8d83-268bfa6d3602`.
  Covers neighborhood orientation; do not create a duplicate Yeonmujang-gil
  neighborhood record merely to obtain a second link.
- Existing **Seongsu Café & Pop-up Exploration**:
  `/local-korea/experiences/343b06d0-a583-4bc2-b0dd-0c69244b134b`.
  Link alongside the proposed park-focused walk; do not copy this entry.
- Existing **Why K-Pop Fans Explore Seoul Beyond Concert Venues**:
  `/articles/a6b1fd18-8b6d-4cc4-bd17-a4b54bf0eee8`.
  A discovery bridge, not a Seongsu pillar or evidence of an artist visiting.
- Sprint 6 **Make a Small Beauty Shopping Plan**, **Read Beauty Packaging With
  Curiosity**, **A Thoughtful Approach to Testers**: adapt principles for beauty.
- Sprint 6 **Browse Independent Shops Considerately**, **Notice Street Style
  Without Intruding**, **Keep a Color-and-Texture Travel Diary**: adapt for fashion.
- Sprint 8 **A Thoughtful Café Afternoon in Seongsu** is a local planning brief,
  not a completed Sprint 6 manuscript. Fold its intent into the half-day draft
  rather than producing two competing itinerary pieces.

Duplicate/topic boundaries:
- Pillar introduces choices; itinerary allocates time; pop-up utility teaches
  verification. Cross-link rather than repeat venue lists.
- Culture piece is a bounded historical introduction, not an unsupported causal
  history. A full “why it became famous” account remains a research task.
- Beauty/fashion pieces adapt earlier general drafts; reconcile any private
  article before deciding whether to revise an existing record or create one.
- Seoul Forest is already a proposed Sprint 8 asset, not a new discovery. No
  published dedicated Place was observed. A park Place is useful and its basic
  identity is sourced, but creation remains blocked on private duplicate review.
- Slow Local Walk differs from the published retail/café Experience by its park
  connection. It is only a draft; route/access verification remains outstanding.
- Existing Seongsu event is not part of this pack. Do not infer that it will run,
  move its date, add meeting instructions or treat it as a bookable walk.

## Files and operator handoff

- `content-pack.json`: seven complete English-first draft bodies, cluster copy,
  SEO metadata, eight editorial prompts, one conditional Place proposal.
- `editorial-drafts.md`: readable manuscript view of the same seven drafts.
- `verification.json`: per-content claim records, source URLs, status and volatility.
- `images.json`: eight 16:9 acquisition briefs; no acquired rights/assets.
- `video-preproduction.md`: English master, Korean reference, timeline/storyboard,
  host/VO/B-roll, lower thirds, titles/description/chapters/thumbnail and five Shorts.
- `field-shoot.json`: 66 planned shots for October 5–11, 2026, not a booked shoot.
- Privacy migration: `supabase/migrations/20261002000000_questions_author_privacy.sql`.
- Tests: `tests/questions-privacy-security.mjs`, `tests/launch-content-security.mjs`.

## Publishing and routing limits — do not hide these

Current editorial section/category pairs are Music/Drama/Movie and
Beauty/Fashion/Food. There is no general travel/history article category.
Assets 1–4 intentionally have a null schema mapping; their local manuscripts
are ready for editorial review, NOT direct database import. Do not mislabel them
as Music or change the schema in this task. Operator may separately decide to
adapt part into existing cluster introduction/Place/Experience text, or request
a future taxonomy decision. Beauty/Fashion fit existing categories; the walk
fits Experiences after validation against the existing form and route check.

Planning slugs are SEO suggestions, not current article URL support. Articles
use `/articles/{UUID}`. Resolve real published IDs before inserting links into
body copy; null URLs are deliberately not clickable placeholders. The existing
plain-text article renderer does not turn Markdown into rich links. Use its
existing related cluster cards or separately reviewed editorial presentation;
do not paste Markdown links expecting new rendering behavior.

Search → pillar (when legitimately publishable) → `/explore/seongsu` (only once
published) → existing Seongsu Place / existing Experience / verified walk →
`/community/questions` → `/write/question` or `/signup` → genuine contribution.
The pack includes explicit CTA gates. No invented live article/cluster URL.

The seven bodies contain [Cxx] editorial evidence markers. These are not public
UI markup. Human editor checks every referenced record and removes markers only
after review. General advice is distinguished from source-backed claims and
unverified proposed routes. No current pop-up, named retailer, opening hour,
price, booking slot, travel time, step-free promise or medical benefit is asserted.

Three narrow facts were source-checked on October 2, 2026:
- KTO's district-level shoemaking account (C01).
- Visit Seoul's description of Yeonmujang-gil (C02; current character needs recheck).
- Visit Seoul's identification of Seoul Forest as an urban park (C03).
These do not validate operational details, permissions or an entire manuscript.
Sources are linked in verification.json. No source image license is inferred.
All seven assets remain local drafts with human publishing approval false.

Image placeholders are only acquisition plans. Actual named places need real
permissioned/licensed images. Generic concepts may be visibly labeled AI
illustrations, never evidence of a store, pop-up, product or visit. Replace planned
concepts after the shoot where appropriate; retain license/consent evidence.

Video is a pre-shoot script, not an eyewitness review. Rehearse to reach 7–9
minutes with actual permitted ambient holds; update chapter times to the edit.
The verdict section explicitly waits for real observations. No footage is claimed.

## Privacy diagnosis and smallest compatible fix

The original Questions migration grants table-level SELECT to anon/authenticated.
RLS hides rows, not columns; approved rows therefore expose author_id through the
API even though current public components select safe fields. Simply revoking
one column would leave the table-level grant effective.

The new migration removes table and existing column SELECT for PUBLIC/anon/
authenticated, then grants safe explicit columns. It does NOT alter INSERT,
UPDATE, DELETE, policies, triggers, schema fields or data. `status` stays readable
for explicit public filters and parent/cluster RLS. Authenticated timestamps
remain readable for moderation/own views. Both anonymous and ordinary signed-in
users lose direct author_id reads, including filters/order and SELECT *.

Admin and member share the database role authenticated. Re-audit confirms the
actual admin moderation flows do not need author_id. The revised migration adds
NO function, view, private-schema helper or privileged client. The earlier draft
identity RPC has been removed before application. Admin direct author_id SELECT
is intentionally denied too. Existing moderation retains all required columns.

Existing query compatibility:
- Public list/detail/home/feed: id/title/body/published_at plus approved filter.
- Cluster target selection/relationship RLS: id/title/body/status, no author.
- Admin question queue: id/title/body/created_at/status, unchanged.
- Moderation: status UPDATE and id RETURNING, unchanged row policy/transition.
- Admin answer context: id/title; answer eligibility: id/status.
- Question submission: author_id INSERT from authenticated server user, unchanged.
- My Contributions: existing own-only SECURITY DEFINER union uses auth.uid(),
  projects no identity and needs no caller author_id SELECT. Left untouched.
- No direct application query requires author_id SELECT. Third-party API clients
  using `select=*` must switch to explicit safe fields; do not restore exposure.

Inherited grants are checked with has_column_privilege inside the transaction;
unexpected effective author access aborts, rather than silently changing role
memberships. No Event/privacy/Storage/Auth/community-media change. One-way
privilege-only migration; rerun repeats normalization/checks without recreating
objects (normal migration tracking should apply it once). No automatic rollback
to insecure table SELECT; investigate affected callers instead.

Reference behavior reviewed against PostgreSQL documentation:
- https://www.postgresql.org/docs/current/sql-grant.html
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://www.postgresql.org/docs/current/sql-createfunction.html

## Local regression and operator checks

The new privacy test executes the actual questions, moderation, answers and
privacy migrations plus the existing My Contributions RPC in an ephemeral
PostgreSQL-in-WASM database. Minimal Auth/profile/other-content fixtures are
local only, never Supabase. Tests cover public fields, forbidden author reads/
WHERE/ORDER/*, private row denial, owner contributions, legitimate and spoofed
submissions, answer eligibility, cluster question joins, identity denial for all
API roles, admin moderation and role revocation. No new identity RPC may exist.
This is stronger than a policy-text model, but not a live Supabase deployment test.

Runtime used: @electric-sql/pglite 0.5.8 installed under ignored node_modules/.cache.
It is NOT a project/runtime dependency; package.json and project lockfile stay
unchanged. To reproduce without changing the shared lockfile, create a separate
temporary directory and install the pinned package there with shared workspace
lockfile disabled; set PGLITE_MODULE_PATH to its absolute dist/index.js path.
Then run `node tests/questions-privacy-security.mjs`. No env file is loaded by it.

Run content manifest validation, all nine existing security/media suites,
lint/build and clusters/community/discovery localhost browser fixtures. No real
accounts, UGC or production uploads are required.

Before applying, review the migration owner and effective grants. After explicit
operator application, perform SELECT-only anonymous/member/admin checks and
manual UI regression. Do not print author UUIDs or credentials. Confirm public
fields readable, author selection denied, private rows hidden, own contributions
intact, admin moderation intact and admin identity SELECT denied. Never verify
write denial by writing production fixtures. No application change is required.

## Remaining gates

Privacy: local migration/role tests and human SQL approval; remote apply is manual.
Content: private duplicate reconciliation, general-article taxonomy decision,
route/operational fact checks, rights/permissions, final human copy approval.
Shoot: date/weather/venue permissions unconfirmed; no assumption of access.
Traffic metadata lives only in this pack: traffic_intent,
future_commercial_intent (none), primary_acquisition_channel (seo). No monetization.

## Verification record — 2026-10-02

- lint/build: PASS; no Next.js application code or dependency changes.
- Existing nine security/media suites: PASS.
- New privacy test: PASS against actual ephemeral PostgreSQL, including an
  unexpected inherited-grant failure and complete migration rollback.
- New content validation: PASS; seven drafts (~340–359 words each), 30 claim
  records (17 source-verified records reusing three narrow facts; 13 unverified),
  eight image plans, eight editorial-only prompts and 66 shot briefs.
- Sprint 7 community, Sprint 8 clusters and discovery browser suites: PASS at
  375/768/1440px using localhost fixtures. No real login/submission/media writes.
- Secret-pattern scan: PASS, excluding one exact existing dummy test credential.
  .env.local, test runtime and build/screenshots remain ignored.
- Production content, DB, Storage, Auth unchanged. No commit/push/deployment.
- READY FOR CONTENT REVIEW: YES, not ready for automatic publication.
- READY TO APPLY PRIVACY MIGRATION: YES after operator SQL review/approval;
  not applied remotely by this task. Recheck production role topology and then
  run the described read-only access verification after applying.
