-- DRAFT ONLY. Additive Events MVP. Do not apply without review.
-- No bootstrap, seed rows, or changes to existing tables/policies/functions.
begin;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null check (char_length(btrim(description)) between 10 and 10000),
  public_area text not null check (char_length(btrim(public_area)) between 2 and 200),
  category text not null check (char_length(btrim(category)) between 2 and 80),
  starts_at timestamptz not null,
  application_deadline timestamptz,
  participation_info text check (participation_info is null or char_length(participation_info) <= 5000),
  cancellation_policy text check (cancellation_policy is null or char_length(cancellation_policy) <= 5000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint events_deadline_check check (application_deadline is null or application_deadline <= starts_at),
  constraint events_publication_check check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
  )
);

-- Physically separate private content: public events SELECT can never include it.
-- Editorial operators must keep exact addresses/contact details OUT of events.
create table public.event_meeting_details (
  event_id uuid primary key references public.events(id) on delete cascade,
  meeting_details text not null check (char_length(btrim(meeting_details)) between 2 and 5000)
);

create table public.event_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint event_applications_one_per_member unique (member_id, event_id),
  constraint event_applications_decision_check check (
    (status = 'pending' and decided_at is null)
    or (status in ('approved', 'rejected') and decided_at is not null)
  )
);

alter table public.events enable row level security;
alter table public.event_meeting_details enable row level security;
alter table public.event_applications enable row level security;
revoke all on table public.events, public.event_meeting_details, public.event_applications
  from public, anon, authenticated;

-- No client writes for editorial events or meeting information; no hosting UI.
grant select (id, title, description, public_area, category, starts_at,
  application_deadline, participation_info, cancellation_policy, status, published_at)
  on public.events to anon, authenticated;
create policy "events_public_select_published" on public.events
for select to anon, authenticated using (status = 'published');

-- member_id may be used in own-only filters. RLS exposes no other member rows
-- except to trusted admins; application UI never selects or renders identities.
grant select (id, event_id, member_id, status, created_at, updated_at, decided_at)
  on public.event_applications to authenticated;
grant insert (event_id, member_id) on public.event_applications to authenticated;
grant update (status) on public.event_applications to authenticated;

create policy "event_applications_select_own" on public.event_applications
for select to authenticated using (member_id = (select auth.uid()));
create policy "event_applications_admin_select_all" on public.event_applications
for select to authenticated using (exists (
  select 1 from public.profiles as p where p.id = (select auth.uid()) and p.role = 'admin'
));

-- Explicit published/time checks apply equally to members and admins inserting
-- applications. RLS checks DB time, never a browser clock or submitted deadline.
create policy "event_applications_insert_own_open_event" on public.event_applications
for insert to authenticated with check (
  member_id = (select auth.uid()) and status = 'pending' and decided_at is null
  and exists (
    select 1 from public.events as e where e.id = event_applications.event_id
      and e.status = 'published' and e.starts_at > pg_catalog.statement_timestamp()
      and (e.application_deadline is null or e.application_deadline > pg_catalog.statement_timestamp())
  )
);

create policy "event_applications_admin_moderate_pending" on public.event_applications
for update to authenticated
using (status = 'pending' and exists (
  select 1 from public.profiles as p where p.id = (select auth.uid()) and p.role = 'admin'
))
with check (
  status in ('approved', 'rejected') and decided_at is not null
  and exists (select 1 from public.profiles as p where p.id = (select auth.uid()) and p.role = 'admin')
  and (status = 'rejected' or exists (
    select 1 from public.events as e where e.id = event_applications.event_id
      and e.status = 'published' and e.starts_at > pg_catalog.statement_timestamp()
  ))
);

-- No admin bypass here: even an admin must be an approved participant to read
-- meeting details through the application API. Operators manage content separately.
grant select (event_id, meeting_details) on public.event_meeting_details to authenticated;
create policy "event_meeting_details_approved_participant_only" on public.event_meeting_details
for select to authenticated using (
  exists (select 1 from public.event_applications as a
    where a.event_id = event_meeting_details.event_id
      and a.member_id = (select auth.uid()) and a.status = 'approved')
  and exists (select 1 from public.events as e
    where e.id = event_meeting_details.event_id and e.status = 'published')
);
-- anon has no table or column SELECT privilege on either private table.
-- No member UPDATE policy and no client DELETE privileges/policies.

create function public.maintain_event_timestamps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then new.created_at = pg_catalog.now(); end if;
  new.updated_at = pg_catalog.now();
  if new.status = 'published' then
    if tg_op = 'INSERT' then new.published_at = pg_catalog.statement_timestamp();
    elsif old.status is distinct from 'published' then new.published_at = pg_catalog.statement_timestamp();
    else new.published_at = old.published_at;
    end if;
  else new.published_at = null;
  end if;
  return new;
end;
$$;
revoke all on function public.maintain_event_timestamps() from public, anon, authenticated;
create trigger events_maintain_timestamps before insert or update on public.events
for each row execute function public.maintain_event_timestamps();

create function public.enforce_event_application_decision()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.status <> 'pending' or new.status is null or new.status not in ('approved', 'rejected') then
    raise exception 'Application requires a pending state and a final decision.' using errcode = '23514';
  end if;
  new.decided_at = pg_catalog.statement_timestamp();
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.enforce_event_application_decision() from public, anon, authenticated;
create trigger event_applications_enforce_decision before update on public.event_applications
for each row execute function public.enforce_event_application_decision();

create index events_upcoming_idx on public.events (starts_at, id) where status = 'published';
create index event_applications_pending_idx on public.event_applications (created_at, id) where status = 'pending';
-- Supports event FK cascade; member lookups use the UNIQUE(member_id,event_id) index.
create index event_applications_event_idx on public.event_applications (event_id);

-- Review notes:
-- RLS subqueries use existing SELECT privileges; no SECURITY DEFINER or recursion.
-- UPDATE USING checks old row; WITH CHECK checks post-trigger new row.
-- Missing/private event has no eligible row; errors must be generalized by UI.
-- Duplicate insertion returns 23505; do not use upsert (no member UPDATE).
-- Own application queries must filter member_id=verified user even for admins.
-- Public event queries must explicitly filter published; never join private data.
-- My Events only queries meeting details after verified own approval. RLS remains
-- authoritative even if that UI check is bypassed or becomes stale.
-- Published event unpublishing hides meeting details immediately on subsequent
-- queries. Previously authorized disclosures cannot be revoked from user memory.
-- No capacity, cancellations, or reapplication after rejection in this MVP.
-- Parent checks use statement snapshots; coordinate privileged editorial changes
-- with moderation. Future cancellation/reversal requires separate schema review.
-- Owners/BYPASSRLS remain privileged. Never expose their credentials.
-- Deleting event/user cascades related applications; only editorial operators can.
commit;

-- Read-only verification after approved deployment (not executed here):
-- select tablename, policyname, cmd, qual, with_check from pg_catalog.pg_policies
-- where schemaname='public' and tablename in ('events','event_applications','event_meeting_details');
-- select table_name, grantee, column_name, privilege_type from information_schema.column_privileges
-- where table_schema='public' and table_name in ('events','event_applications','event_meeting_details');
-- Test in isolation: anonymous, non-applicant, pending, rejected, approved own vs
-- another event, admin without application, duplicate, deadline, past/draft event,
-- forged identity/status, one-way moderation, zero rows, and direct private SELECT.
