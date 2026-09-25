-- Korean Wave Community: one-way admin question moderation.
-- DRAFT ONLY. Apply separately after review; no bootstrap or data backfill.
-- Requires the existing profiles and questions migrations, including own-profile
-- SELECT and protected profiles.role. No service credential is needed by clients.
begin;

-- Validate existing rows atomically. Existing pending/null rows are compatible.
-- If inconsistent historical data exists, abort rather than silently rewrite it.
alter table public.questions
  add constraint questions_status_publication_consistency_check
  check (
    (status = 'approved' and published_at is not null)
    or (status in ('pending', 'rejected') and published_at is null)
  );

-- Table-level UPDATE would override column restrictions. Clear both grant forms
-- on this table only, then allow the two moderation columns. RLS below still
-- denies every member UPDATE, including updates to their own questions.
revoke update on table public.questions from public, anon, authenticated;
revoke update (id, author_id, title, body, status, created_at, updated_at, published_at)
  on table public.questions from public, anon, authenticated;
grant update (status, published_at) on table public.questions to authenticated;

-- SELECT is also needed for UPDATE/RETURNING. Include terminal states so an
-- admin can read the result of a rejection, not only the pending source row.
-- This broadens questions visibility for admins only, not profiles visibility.
-- The subquery runs as the caller: existing own-profile RLS and SELECT grants
-- suffice. Missing profile / null auth.uid() / member role all fail closed.
create policy "questions_admin_select_all"
on public.questions
for select to authenticated
using (
  exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'admin'
  )
);

-- USING tests the old row; WITH CHECK tests the row after BEFORE triggers.
-- Existing SELECT/INSERT policies do not grant UPDATE permission.
create policy "questions_admin_moderate_pending"
on public.questions
for update to authenticated
using (
  status = 'pending'
  and exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'admin'
  )
  and (
    (status = 'approved' and published_at is not null)
    or (status = 'rejected' and published_at is null)
  )
);

-- Authoritative approval time, never a client-selected past/future timestamp.
-- Additional transition guard makes terminal rows immutable even if a future
-- UPDATE policy is accidentally widened. No SECURITY DEFINER / elevated access.
-- Existing questions_set_updated_at continues to maintain updated_at unchanged.
create function public.enforce_question_moderation_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'pending'
     or new.status is null
     or new.status not in ('approved', 'rejected') then
    raise exception 'Question moderation requires a pending question and a final decision.'
      using errcode = '23514';
  end if;

  if new.status = 'approved' then
    new.published_at = pg_catalog.statement_timestamp();
  else
    new.published_at = null;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_question_moderation_transition()
  from public, anon, authenticated;

create trigger questions_enforce_moderation_transition
before update on public.questions
for each row
execute function public.enforce_question_moderation_transition();

-- Future UI should send only status and filter by id AND status = 'pending'.
-- A zero-row UPDATE (already moderated or not authorized) is not success.
-- Concurrent decisions cannot re-moderate a terminal row; handle zero-row/error.
-- INSERT privileges, DELETE denial, existing indexes and updated_at trigger stay
-- unchanged. No profile, Auth account, existing question, or role is updated.
-- Owners/BYPASSRLS remain privileged; never expose their credentials to clients.
-- The transition trigger also restricts maintenance UPDATEs; any future editing
-- or reversal workflow requires a separately reviewed migration.

commit;

-- Post-application read-only verification (run separately when approved):
-- select policyname, cmd, roles, qual, with_check from pg_catalog.pg_policies
-- where schemaname = 'public' and tablename = 'questions';
-- select grantee, privilege_type from information_schema.table_privileges
-- where table_schema = 'public' and table_name = 'questions'
-- and grantee in ('PUBLIC', 'anon', 'authenticated');
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'questions'
-- and privilege_type = 'UPDATE';
-- select conname, pg_catalog.pg_get_constraintdef(oid)
-- from pg_catalog.pg_constraint where conrelid = 'public.questions'::regclass;
-- select tgname, pg_catalog.pg_get_triggerdef(oid)
-- from pg_catalog.pg_trigger
-- where tgrelid = 'public.questions'::regclass and not tgisinternal;
-- RLS role-matrix tests should use an isolated test DB, not production questions.
