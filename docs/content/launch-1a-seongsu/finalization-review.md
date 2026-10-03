# Launch 1A finalization review — 2026-10-03

## Scope

Only `docs/content/launch-1a-seongsu/**`,
`supabase/migrations/20261002000000_questions_author_privacy.sql`,
`tests/launch-content-security.mjs`, `tests/questions-privacy-security.mjs`.
Mobile navigation hotfix is already a separate commit; no additional application
code, dependencies, schema, Auth, Storage or RLS edits are included here.
Production reads only: published public content inventory, safe columns.
No users, UGC, editorial records, uploads or publication created.

## Privacy migration provenance — commit gate

Local SHA-256:
`2B00762EE10FA7A15942C58390BA93BEE5B1C9EDA8CA4501B86B8A7AE4BF4C7A`

Local SQL reviewed in full: revoke whole-table SELECT and prior column SELECT;
grant explicit safe columns; retain `status` for filters and authenticated
timestamps for admin/owner views; deny `author_id` to both API roles; fail closed
on inherited privileges. No identity RPC or new SECURITY DEFINER function.
Existing RLS, mutations and triggers unchanged. File has not been edited.

Operator explicitly confirmed on 2026-10-03 that the reviewed revised file was
applied to Production without modifying its SQL. Confirmed no identity RPC,
new SECURITY DEFINER function, view or privileged client; whole-table SELECT
revocation, safe column grants and fail-closed checks retained. Applied-file
match is accepted on operator attestation, not independent remote text retrieval.
The local hash above remains unchanged.

Operator-reported production checks: anon/authenticated author_id SELECT false;
anon/authenticated title SELECT true. Public approved questions, My Contributions,
answers and admin moderation manually verified normal. No new remote checks or
mutations are performed during commit finalization. Commit/push gate cleared;
Seongsu publication remains unauthorized.

Authorized commit message:
`launch: prepare Seongsu content and harden question privacy`

## Rerun evidence

- Lint: PASS.
- Build: PASS. First sandbox run compiled, then TypeScript worker spawn returned
  EPERM. Same normal build rerun with process-spawn permission passed. No build
  directory/config workaround, no configuration edits.
- All nine existing security/media suites: PASS (site, editorial, events,
  SSR auth, discovery, community, community media, clusters, site media).
- Launch content validation: PASS.
- Privacy regression: PASS in isolated PostgreSQL/PGlite. Effective grants,
  private rows, own contributions, answer eligibility, admin moderation,
  question linking and inherited-grant rollback tested. No remote test writes.
- Sprint 7 community browser regression: PASS, 375/768/1440, local fixtures.
- Sprint 8 cluster browser regression: PASS, 375/768/1440, local fixtures.
- Discovery browser regression: PASS, 375/768/1440, 20 public routes and admin
  fixture checks. No production mutation or real-user authentication.
- `.env.local`, `.next` and `node_modules` ignored; no tracked env files.

## Publication gates

First batch review is prepared, not published. Three general travel articles
cannot honestly fit current editorial categories. No category/schema workaround
was implemented. Private duplicate reconciliation, route field checks, image
rights and human approval remain required. See the batch handoff for precise
gates, existing IDs, sources and operator steps.
