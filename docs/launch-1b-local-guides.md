# Launch 1B — Local Korea editorial Guides

## Scope and rollout

One new pair: `local-korea` / `guides`, in `editorial_articles` only.
Places and Experiences remain structured entities in their existing tables.
No data changes, seed, remote migration execution, Auth/Storage/RLS change,
publication, commit or push is performed by this task.

Review and apply `supabase/migrations/20261004000000_local_korea_editorial_guides.sql`
before attempting to save the new classification in Production. Deploy the
compatible application separately after approval. Existing categories remain
usable with the old schema; new Guides saves require this migration.

The migration atomically replaces only the named category CHECK. All six old
combinations remain valid and existing rows are not rewritten. Constraint
validation takes a table lock; choose a suitable application window. Failure
rolls the transaction back. No grants/policies/indexes/timestamp triggers change.
Do not revert to the old CHECK after Guides have been created without a separate
content-handling plan. This is a forward-only tracked migration, not a seed.

## Existing workflows reused

- Admin Content → New → Local Korea → Guides; Save draft, preview, publish and
  return-to-draft use the existing admin authorization and explicit payload.
- `/local-korea` links to `/local-korea/guides`; published-only listing reuses
  editorial cards, empty/error states and publication ordering.
- Detail remains `/articles/{UUID}`; category back link leads to Guides.
- Search already queries published editorial articles across sections, so no
  new search table or query permissions are needed.
- Cluster selection and links use `article_id`; published-only target filtering
  and draft privacy remain in the existing cluster DAL/RLS.
- Home's Local Korea section remains structured Places/Experiences discovery;
  its Local Korea landing link leads to Guides. No homepage redesign.
- Existing plain-text body, image security and UUID canonical convention remain.

## Operator manual E2E after migration/deployment

Use an approved editorial draft, not fake UGC. Confirm section/category switching,
save draft and authorized preview. Confirm anonymous detail/search/cluster do not
expose the draft. Publish only with separate content approval, then check Guides,
article back link, search and an existing cluster connection. Return-to-draft must
hide the article again. This implementation task performs none of those remote
mutations or content publication steps.

The prior Launch 1A category blocker is resolved by this code plus the unapplied
migration, not yet in Production. Field checks, image rights and final human
content approval still apply to the Seongsu batch.

## Local regression coverage

`local-guides-security.mjs` executes the original editorial migration and the new
CHECK migration in isolated PGlite PostgreSQL (same ignored test runtime as the
privacy suite). Covers all old combinations/unchanged rows, invalid cross-pairs,
member/anon write denial, admin creation/publication/unpublication, private drafts
and protected publication timestamps. No env files or remote database access.

Editorial action tests exercise Guides payload/validation/published filtering.
Discovery browser tests exercise real select changes, listing/detail/back link,
search, responsive layout and authorized draft preview on localhost fixtures.
Cluster browser fixtures include Guides with existing article relationships.

Verification on 2026-10-04: lint/build PASS; all nine existing security/media
suites PASS; editorial and isolated PostgreSQL Guides checks PASS; Launch 1A
content and privacy regressions PASS; discovery/search, Sprint 8 clusters and
Sprint 7 community browser suites PASS at 375/768/1440px. New browser checks
include actual category selection, Guides navigation and admin draft preview.
Tests use local fixtures, not Production. Migration remains unapplied; no commit
or push has been performed.
