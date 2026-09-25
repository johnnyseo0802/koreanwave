-- DRAFT ONLY: Ask a Local answers with one-way moderation.
-- Additive migration. No bootstrap, backfill, test data, or existing-object edits.
begin;

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint answers_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint answers_body_length_check check (
    char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 2 and 5000
  ),
  constraint answers_publication_check check (
    (status = 'approved' and published_at is not null)
    or (status in ('pending', 'rejected') and published_at is null)
  )
);

alter table public.answers enable row level security;
revoke all on table public.answers from public, anon, authenticated;

-- No table SELECT grant: author_id is not readable, even by authenticated admins.
-- INSERT/UPDATE RETURNING * and select('*') must NOT be used by future clients.
grant select (id, question_id, body, status, published_at)
  on table public.answers to anon;
grant select (id, question_id, body, status, created_at, updated_at, published_at)
  on table public.answers to authenticated;
grant insert (question_id, author_id, body) on table public.answers to authenticated;
grant update (status, published_at) on table public.answers to authenticated;
-- The last grant only enables the operation on these columns; admin RLS below
-- still denies all member updates. No DELETE grant/policy for either client role.

create policy "answers_public_select_approved"
on public.answers for select to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1 from public.questions as question
    where question.id = answers.question_id and question.status = 'approved'
  )
);

create policy "answers_author_select_own"
on public.answers for select to authenticated
using (author_id = (select auth.uid()));

-- Caller can already SELECT their own profiles.role under existing profiles RLS.
-- No SECURITY DEFINER, metadata, client role claim, or elevated credential needed.
create policy "answers_admin_select_all"
on public.answers for select to authenticated
using (
  exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'admin'
  )
);

create policy "answers_member_insert_own_pending_on_approved_question"
on public.answers for insert to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and published_at is null
  and exists (
    select 1 from public.questions as question
    where question.id = answers.question_id and question.status = 'approved'
  )
);

-- USING checks the pending source row. WITH CHECK checks the new row after
-- BEFORE triggers, including the DB-generated publication timestamp.
create policy "answers_admin_moderate_pending"
on public.answers for update to authenticated
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
    (status = 'rejected' and published_at is null)
    or (
      status = 'approved' and published_at is not null
      and exists (
        select 1 from public.questions as question
        where question.id = answers.question_id and question.status = 'approved'
      )
    )
  )
);

-- Existing trigger functions are named for their owning tables, not a shared
-- contract. Use a dedicated function to avoid coupling answers to later edits
-- of question/profile functions. One trigger means no ordering dependency.
create function public.enforce_answer_moderation_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'pending'
     or new.status is null
     or new.status not in ('approved', 'rejected') then
    raise exception 'Answer moderation requires a pending answer and a final decision.'
      using errcode = '23514';
  end if;

  if new.status = 'approved' then
    new.published_at = pg_catalog.statement_timestamp();
  else
    new.published_at = null;
  end if;
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.enforce_answer_moderation_transition()
  from public, anon, authenticated;

create trigger answers_enforce_moderation_transition
before update on public.answers
for each row execute function public.enforce_answer_moderation_transition();

-- Full leading question_id index also supports FK cascade lookups for ALL
-- statuses; avoids a separate redundant question_id index. Public reads add
-- status = 'approved' and order by published_at DESC.
create index answers_question_status_published_idx
  on public.answers (question_id, status, published_at desc nulls last);
create index answers_pending_created_idx
  on public.answers (created_at, id) where status = 'pending';
create index answers_author_created_idx
  on public.answers (author_id, created_at desc);

comment on table public.answers is
  'Moderated Ask a Local answers. Public reads require approved answer and question; author identities are not selectable by client roles.';

-- Future public queries MUST explicitly filter status = 'approved', even for
-- authors/admins whose SELECT policies expose additional rows. Select only
-- id, question_id, body, published_at for rendering; never request author_id.
-- Authors can read their own rows, including pending/rejected, via RLS. Because
-- author_id has no SELECT grant, a client WHERE author_id = ... also fails.
-- A future own-only submissions RPC/view needs separate review; do not widen
-- author_id SELECT for all authenticated users to implement My Submissions.
-- Admin SELECT covers all rows but not author identity; body/status/timestamps
-- suffice for moderation. Privileges cannot distinguish member/admin app roles.
-- Future moderation sends only status, filters id AND status = 'pending', and
-- uses RETURNING id. Zero returned rows is failure, including concurrent review.
-- Approved parent checks rely on the current immutable question lifecycle.
-- Future question unpublishing needs concurrency/lifecycle review; public SELECT
-- already hides answers whose parent is not approved. FK deletion cascades.
-- Auth-user deletion cascades their answers; deleting a question cascades all
-- its answers, including those written by other users. No client DELETE allowed.
-- Body length is a Unicode character/whitespace check, not a semantic quality or
-- spam check. Future rendering must escape text; moderation/rate limits remain
-- application concerns. No submission rate limiting is provided by this draft.
-- Owners/BYPASSRLS are outside the client-role boundary. Do not expose those
-- credentials. Terminal trigger also blocks privileged ordinary UPDATEs;
-- future editing/reversal must be reviewed explicitly.

commit;

-- Suggested post-application read-only inspection (not executed here):
-- select policyname, cmd, roles, qual, with_check from pg_catalog.pg_policies
-- where schemaname = 'public' and tablename = 'answers';
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'answers';
-- select conname, pg_catalog.pg_get_constraintdef(oid)
-- from pg_catalog.pg_constraint where conrelid = 'public.answers'::regclass;
-- select tgname, pg_catalog.pg_get_triggerdef(oid) from pg_catalog.pg_trigger
-- where tgrelid = 'public.answers'::regclass and not tgisinternal;
-- Before production application, test grants + RLS in an isolated database:
-- anon/member/author/admin, private/nonexistent parents, spoofed authors,
-- protected INSERT fields, UPDATE RETURNING id, terminal retries, timestamp
-- overriding, whitespace/length boundaries, and forbidden author_id SELECT.
