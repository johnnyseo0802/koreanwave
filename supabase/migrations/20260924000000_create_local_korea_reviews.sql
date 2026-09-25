-- DRAFT ONLY: Place reviews with one-way moderation.
-- Additive migration. No bootstrap, backfill, test data, or existing-object edits.
begin;

-- No existing Places/Experiences/Reviews model was found in repository migrations.
-- Shared only by these new editorial tables; no existing trigger is changed.
create function public.maintain_local_content_timestamps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = pg_catalog.now();
  end if;
  new.updated_at = pg_catalog.now();
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      new.published_at = pg_catalog.statement_timestamp();
    elsif old.status is distinct from 'published' then
      new.published_at = pg_catalog.statement_timestamp();
    else
      new.published_at = old.published_at;
    end if;
  else
    new.published_at = null;
  end if;
  return new;
end;
$$;
revoke all on function public.maintain_local_content_timestamps() from public, anon, authenticated;

-- Editorial content only: no client INSERT/UPDATE/DELETE grants in this sprint.
-- Publication/curation is a separate trusted operator workflow, not member UGC.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  area text not null check (char_length(btrim(area)) between 2 and 160),
  category text not null check (char_length(btrim(category)) between 2 and 80),
  description text not null check (char_length(btrim(description)) between 10 and 10000),
  visitor_info text check (visitor_info is null or char_length(visitor_info) <= 5000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint places_publication_check check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
  )
);
alter table public.places enable row level security;
revoke all on table public.places from public, anon, authenticated;
grant select (id, name, area, category, description, visitor_info, status, published_at)
  on table public.places to anon, authenticated;
create policy "places_public_select_published" on public.places
for select to anon, authenticated using (status = 'published');
create trigger places_maintain_timestamps
before insert or update on public.places
for each row execute function public.maintain_local_content_timestamps();
create index places_published_idx on public.places (published_at desc)
where status = 'published';

-- Editorial content only: no client INSERT/UPDATE/DELETE grants in this sprint.
-- Publication/curation is a separate trusted operator workflow, not member UGC.
create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  area text not null check (char_length(btrim(area)) between 2 and 160),
  category text not null check (char_length(btrim(category)) between 2 and 80),
  description text not null check (char_length(btrim(description)) between 10 and 10000),
  visitor_info text check (visitor_info is null or char_length(visitor_info) <= 5000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint experiences_publication_check check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
  )
);
alter table public.experiences enable row level security;
revoke all on table public.experiences from public, anon, authenticated;
grant select (id, name, area, category, description, visitor_info, status, published_at)
  on table public.experiences to anon, authenticated;
create policy "experiences_public_select_published" on public.experiences
for select to anon, authenticated using (status = 'published');
create trigger experiences_maintain_timestamps
before insert or update on public.experiences
for each row execute function public.maintain_local_content_timestamps();
create index experiences_published_idx on public.experiences (published_at desc)
where status = 'published';


create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint reviews_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint reviews_body_length_check check (
    char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 2 and 5000
  ),
  constraint reviews_publication_check check (
    (status = 'approved' and published_at is not null)
    or (status in ('pending', 'rejected') and published_at is null)
  )
);

alter table public.reviews enable row level security;
revoke all on table public.reviews from public, anon, authenticated;

-- No table SELECT grant: author_id is not readable, even by authenticated admins.
-- INSERT/UPDATE RETURNING * and select('*') must NOT be used by future clients.
grant select (id, place_id, body, status, published_at)
  on table public.reviews to anon;
grant select (id, place_id, body, status, created_at, updated_at, published_at)
  on table public.reviews to authenticated;
grant insert (place_id, author_id, body) on table public.reviews to authenticated;
grant update (status, published_at) on table public.reviews to authenticated;
-- The last grant only enables the operation on these columns; admin RLS below
-- still denies all member updates. No DELETE grant/policy for either client role.

create policy "reviews_public_select_approved"
on public.reviews for select to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1 from public.places as place
    where place.id = reviews.place_id and place.status = 'published'
  )
);

create policy "reviews_author_select_own"
on public.reviews for select to authenticated
using (author_id = (select auth.uid()));

-- Caller can already SELECT their own profiles.role under existing profiles RLS.
-- No SECURITY DEFINER, metadata, client role claim, or elevated credential needed.
create policy "reviews_admin_select_all"
on public.reviews for select to authenticated
using (
  exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'admin'
  )
);

create policy "reviews_member_insert_own_pending_on_published_place"
on public.reviews for insert to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and published_at is null
  and exists (
    select 1 from public.places as place
    where place.id = reviews.place_id and place.status = 'published'
  )
);

-- USING checks the pending source row. WITH CHECK checks the new row after
-- BEFORE triggers, including the DB-generated publication timestamp.
create policy "reviews_admin_moderate_pending"
on public.reviews for update to authenticated
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
        select 1 from public.places as place
        where place.id = reviews.place_id and place.status = 'published'
      )
    )
  )
);

-- Existing trigger functions are named for their owning tables, not a shared
-- contract. Use a dedicated function to avoid coupling reviews to later edits
-- of place/profile functions. One trigger means no ordering dependency.
create function public.enforce_review_moderation_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'pending'
     or new.status is null
     or new.status not in ('approved', 'rejected') then
    raise exception 'Review moderation requires a pending review and a final decision.'
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

revoke all on function public.enforce_review_moderation_transition()
  from public, anon, authenticated;

create trigger reviews_enforce_moderation_transition
before update on public.reviews
for each row execute function public.enforce_review_moderation_transition();

-- Full leading place_id index also supports FK cascade lookups for ALL
-- statuses; avoids a separate redundant place_id index. Public reads add
-- status = 'approved' and order by published_at DESC.
create index reviews_place_status_published_idx
  on public.reviews (place_id, status, published_at desc nulls last);
create index reviews_pending_created_idx
  on public.reviews (created_at, id) where status = 'pending';
create index reviews_author_created_idx
  on public.reviews (author_id, created_at desc);

comment on table public.reviews is
  'Moderated place reviews. Public reads require an approved review and a published place; author identities are not selectable by client roles.';

-- Future public queries MUST explicitly filter status = 'approved', even for
-- authors/admins whose SELECT policies expose additional rows. Select only
-- id, place_id, body, published_at for rendering; never request author_id.
-- Authors can read their own rows, including pending/rejected, via RLS. Because
-- author_id has no SELECT grant, a client WHERE author_id = ... also fails.
-- A future own-only submissions RPC/view needs separate review; do not widen
-- author_id SELECT for all authenticated users to implement My Submissions.
-- Admin SELECT covers all rows but not author identity; body/status/timestamps
-- suffice for moderation. Privileges cannot distinguish member/admin app roles.
-- Future moderation sends only status, filters id AND status = 'pending', and
-- uses RETURNING id. Zero returned rows is failure, including concurrent review.
-- Public review SELECT and INSERT require a currently published place.
-- Privileged editorial unpublishing hides its reviews; review rejection remains
-- possible, while approval requires a published place. Lifecycle changes are
-- operator-only; concurrent curation/moderation should be coordinated.
-- Auth-user deletion cascades their reviews; deleting a place cascades all
-- its reviews, including those written by other users. No client DELETE allowed.
-- Body length is a Unicode character/whitespace check, not a semantic quality or
-- spam check. Future rendering must escape text; moderation/rate limits remain
-- application concerns. No submission rate limiting is provided by this draft.
-- Owners/BYPASSRLS are outside the client-role boundary. Do not expose those
-- credentials. Terminal trigger also blocks privileged ordinary UPDATEs;
-- future editing/reversal must be reviewed explicitly.

commit;

-- Suggested post-application read-only inspection (not executed here):
-- select policyname, cmd, roles, qual, with_check from pg_catalog.pg_policies
-- where schemaname = 'public' and tablename = 'reviews';
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'reviews';
-- select conname, pg_catalog.pg_get_constraintdef(oid)
-- from pg_catalog.pg_constraint where conrelid = 'public.reviews'::regclass;
-- select tgname, pg_catalog.pg_get_triggerdef(oid) from pg_catalog.pg_trigger
-- where tgrelid = 'public.reviews'::regclass and not tgisinternal;
-- Before production application, test grants + RLS in an isolated database:
-- anon/member/author/admin, private/nonexistent parents, spoofed authors,
-- protected INSERT fields, UPDATE RETURNING id, terminal retries, timestamp
-- overriding, whitespace/length boundaries, and forbidden author_id SELECT.
