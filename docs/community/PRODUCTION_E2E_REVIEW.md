# Sprint 7 production E2E review — 2026-09-29

Historical pre-finalization observations below refer to Sprint 6 deployment
`22f9041`. The operator subsequently authorized Sprint 7 commit/push after local
checks. Do not interpret the older no-push scope or route results as current
deployment status; verify the newly deployed routes after that push. Production
authenticated role/Storage checks remain manual and must not be reported as passed
from local mocks alone.

## Scope and evidence

The user reports the migration applied and the server-only media secret configured
in Vercel Production. We did not read/test the real secret, use elevated access,
log in as a real member/admin, deploy, commit, push, or write production data.
Only publishable-key anonymous read queries and public deployment GETs were made.
Existing test accounts in the repository are local fixtures, not authenticated
production sessions. No established test cleanup workflow exists for immutable
community posts/private uploads. Therefore no disposable production UGC was made.

## Actual observations

- Local HEAD is `22f9041` (Sprint 6); Sprint 7 is still uncommitted in the worktree.
- Production `/community` returns200 but lacks the Sprint 7 feed introduction.
- Production `/write/moment`, `/account/contributions`, `/admin/community` return404,
  rather than the new authenticated routes' login redirects. The queried media
  path also returns404, which alone cannot distinguish route absence from missing
  media. Together these indicate Sprint 7 code is not available at the tested URL.
  Redeploying an older commit with a new environment variable does not add local code.
- Anonymous community_posts/community_prompt SELECTs return200 and zero rows.
- Private community_uploads/helpful/reports SELECTs return401/42501, not missing-
  relation errors. The endpoints recognize the objects but deny anonymous access.
- author_id/owner_id/member_id/reporter_id probes return401/42501.
- my_community_contributions() is denied anonymously; helpful count RPC accepts
  an empty target array. No caller identity or content was printed.
- The read-only community_media_allowed(object_name) signature returns200,
  consistent with the final one-argument sanitized-media revision.
- Pending/rejected/approved post probes return zero rows; **this is not proof of
  isolation against known existing private fixtures**. No approved image fixture
  is anonymously available, so actual stored format/EXIF cannot yet be checked.
- Bucket metadata request returns NoSuchBucket for anon, while missing-object
  download returns NoSuchKey. These are permission-sensitive; do not infer bucket
  absence, public/private flags, MIME limits or exact policies from those responses.
- Anonymous existing question/answer/review pending/rejected and editorial/local/
  event draft queries return no rows. profiles/applications/meeting details denied.

## Pending catalog confirmation (operator, read-only)

The publishable client cannot audit pg_policies or bucket configuration. Inspect
these in the Supabase SQL Editor without changing anything:

```sql
select relname, relrowsecurity from pg_catalog.pg_class
where relnamespace = 'public'::regnamespace
and relname in ('community_uploads','community_posts','community_helpful',
               'community_reports','community_prompt');
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where (schemaname='public' and tablename like 'community_%')
   or (schemaname='storage' and tablename='objects' and policyname like 'community_media_%');
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='community-media';
select routine_name, security_type from information_schema.routines
where routine_schema='public' and routine_name in
('my_community_contributions','community_media_allowed','community_owns_uploaded_image');
```

Expected private bucket,2MiB,WebP-only; restrictive INSERT/UPDATE/DELETE denials for
anon/authenticated, with read access only for owner/admin/approved. Verify no old
member INSERT policy remains from an earlier version and helpers match the draft.
No catalog query above was executed by the agent.

## Remaining manual E2E, in order

1. Make the reviewed Sprint 7 build available in an explicitly authorized test
   environment (or run it locally against the migrated project). Do not infer
   permission to push/deploy from this test request. Configure the server-only
   variable privately for that environment; do not send its value in chat.
2. Use existing Member A, Member B and admin sessions in separate browser profiles.
   Decide on a safe content lifecycle first: use genuine authorized contributions,
   or an isolated test project with planned cleanup. Do not add permanent fake UGC.
3. A uploads valid JPEG/PNG/WebP via app; inspect sanitized bytes for WebP and no
   EXIF/GPS. Test oversize, unsupported and malformed files. Test direct Storage
   upload denial separately for anon/A/B; never allow successful orphan writes
   without an approved cleanup mechanism. B must not choose A's namespace.
4. Submit one of each type as A; verify pending defaults, own history, no identity/
   status/time forgery, self-moderation/Featured denial and B's read/write denial.
5. Admin previews pending photo; approve one and reject another. Anonymous readers
   must see only approved post+sanitized image. Verify authoritative published_at,
   pending/rejected privacy, and approved-only feature/unfeature.
6. B Helpful on A's approved post: unique vote, own remove, no private target vote;
   A cannot vote own post, and nobody can read other voter identities.
7. Report approved content: one report per reporter/post, private reporter, member
   cannot resolve, admin queue/resolve works. Report resolve does not remove content.
8. Prompt editing only with authorized real prompt content, or isolated fixture;
   member writes denied and CTA reaches corresponding form. No test prompt seeded.
9. A/B contributions must contain only their own posts/questions/answers/reviews;
   no identity parameter is accepted. Repeat admin/Auth/event privacy regression.

## Local verification vs production proof

Run lint/build, site/editorial/events/SSR/discovery security tests, community and
community-media tests, plus local fixture community/discovery browser tests.
These prove code behavior under fixtures and static SQL boundaries, not execution
of production Storage policies as A/B/admin. Keep those results distinct.

Local lint/build and all seven security suites passed. Sprint 7 browser fixtures
passed at375/768/1440px. The first existing discovery browser run encountered
ERR_NETWORK_IO_SUSPENDED; its standalone retry passed20 public routes at all three
widths plus admin layouts, without changing app code or treating the interruption
as a pass. No actual secret was used by tests;
its variable name was absent from built client chunks and no env file is tracked.

No implementation/security defect requiring another migration was established.
The observed blocker is unavailable production app routes plus missing authenticated
role tests, not evidence that the migrated schema needs to be changed.
