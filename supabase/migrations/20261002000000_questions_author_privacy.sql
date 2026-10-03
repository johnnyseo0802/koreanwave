-- Launch Phase 1A. REVIEW ONLY: do not apply remotely without operator approval.
-- Narrow SELECT only. Existing row policies, writes, triggers and data unchanged.
begin;

-- A column REVOKE alone cannot override the old whole-table SELECT grant.
revoke select on table public.questions from public, anon, authenticated;
revoke select (id, author_id, title, body, status, created_at, updated_at, published_at)
  on table public.questions from public, anon, authenticated;

grant select (id, title, body, status, published_at)
  on table public.questions to anon;
grant select (id, title, body, status, created_at, updated_at, published_at)
  on table public.questions to authenticated;

-- Admin moderation does not need author_id. Admin and member share the
-- authenticated database role, so neither receives direct identity SELECT.
-- No new function, view, privileged client or identity lookup is required.
-- Existing moderation reads its safe fields through unchanged admin RLS.
-- Existing my_community_contributions() keeps its own-only projection unchanged.

-- Fail closed if an unexpected inherited grant defeats the intended boundary.
-- Do not silently revoke unrelated role memberships; abort the whole transaction.
do $$
begin
  if pg_catalog.has_column_privilege('anon', 'public.questions', 'author_id', 'SELECT')
     or pg_catalog.has_column_privilege('authenticated', 'public.questions', 'author_id', 'SELECT') then
    raise exception 'Question identity privileges require separate review';
  end if;
end;
$$;

commit;

-- Forward-only, no row rewrites, no Auth/Storage policy changes. Reapplication
-- repeats the same privilege normalization and checks; no objects are recreated.
-- Apply as the trusted migration owner, once through normal migration tracking.
-- Rollback is a separately reviewed privilege change, not a data restore. Prefer
-- fixing callers to select explicit public fields; do not restore public identity
-- exposure automatically. Never use SELECT * or filter/order by author_id in
-- ordinary API queries. Direct admin author_id SELECT also intentionally fails.
