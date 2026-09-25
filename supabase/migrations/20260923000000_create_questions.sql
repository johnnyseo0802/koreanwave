-- Korean Wave Community: Ask a Local moderation queue.
-- One-way migration draft; do not execute against Supabase until approved.
-- Apply atomically so default grants cannot expose the table during setup.
begin;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null,

  constraint questions_status_check
    check (status in ('pending', 'approved', 'rejected')),
  -- Trim whitespace at both ends for validation, including tabs/newlines.
  -- Count PostgreSQL characters, not bytes. Whitespace-only input has length 0.
  -- Preserve submitted text; these checks do not silently rewrite content.
  constraint questions_title_length_check
    check (char_length(regexp_replace(title, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 5 and 160),
  constraint questions_body_length_check
    check (char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 10 and 5000)
);

comment on table public.questions is
  'Ask a Local questions. Members submit pending content; publication requires future moderation.';
comment on column public.questions.published_at is
  'Reserved for moderation. Future approval must set this timestamp together with approved status.';

alter table public.questions enable row level security;

-- Reset grants on this NEW table only, including inherited PUBLIC privileges.
-- No changes to profiles, auth.users, their triggers, or default privileges.
revoke all on table public.questions from public, anon, authenticated;
grant select on table public.questions to anon, authenticated;

-- All other INSERT columns receive database defaults. Clients cannot choose
-- status, published_at, id, created_at, or updated_at, even when using DEFAULT.
-- Do not add a table-level INSERT grant: it would bypass this column boundary.
grant insert (author_id, title, body) on table public.questions to authenticated;

create policy "questions_anon_select_approved"
on public.questions
for select to anon
using (status = 'approved');

create policy "questions_authenticated_select_approved_or_own"
on public.questions
for select to authenticated
using (status = 'approved' or author_id = (select auth.uid()));

-- WITH CHECK examines the new row after defaults. The author cannot be spoofed.
-- Status/timestamp checks also defend against accidentally widened INSERT grants.
create policy "questions_authenticated_insert_own_pending"
on public.questions
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and published_at is null
);

-- No UPDATE/DELETE grants or policies for anon/authenticated in this migration.
-- An authenticated admin remains subject to the same restrictions for now.
-- Future moderation must separately verify protected profiles.role = 'admin',
-- define narrow update privileges/policies, and set status/published_at together.
-- Do not use user-editable metadata for authorization or expose service keys.

-- Dedicated invoker trigger: no elevated privileges or shared profiles function.
-- Runs for every permitted future update, including moderation changes.
create function public.set_questions_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_questions_updated_at() from public, anon, authenticated;

create trigger questions_set_updated_at
before update on public.questions
for each row
execute function public.set_questions_updated_at();

-- Public list: WHERE status = 'approved' ORDER BY published_at DESC NULLS LAST.
-- Partial index avoids indexing the private moderation queue for public reads.
create index questions_approved_published_at_idx
on public.questions (published_at desc nulls last)
where status = 'approved';

-- My Submissions: WHERE author_id = auth.uid() ORDER BY created_at DESC.
-- The leading author_id also supports auth.users ON DELETE CASCADE lookups.
create index questions_author_created_at_idx
on public.questions (author_id, created_at desc);

-- Static security review:
-- anon: approved SELECT only; no write privileges or policies.
-- authenticated: approved/own SELECT; only own pending INSERT with null publication.
-- UPDATE/DELETE denied by both grants and absence of policies.
-- Owners/BYPASSRLS roles remain privileged; never distribute their credentials.
-- Approved SELECT exposes all table columns, including author_id, by design.
-- It does not grant access to auth.users or private profiles.
-- Deleting an Auth account cascades its questions regardless of question policies.
-- No approval/backfill/test data or admin policy is created here.

commit;
