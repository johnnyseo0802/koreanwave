-- Korean Wave Community: private member profiles
--
-- This migration intentionally creates no public profile directory. Profiles are
-- private to their owner and are linked 1:1 to the Supabase Auth user record.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  country text,
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'ko')),
  role text not null default 'member'
    check (role in ('member', 'admin')),
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Private application profile data. One row per auth.users account.';
comment on column public.profiles.role is
  'Application role. Clients cannot update this column.';

-- RLS is the row-level boundary. Explicit grants below are the operation and
-- column-level boundary; both are required for browser Data API access.
alter table public.profiles enable row level security;

-- Remove any platform-default table privileges before adding the narrow client
-- permissions required by the MVP. anon receives no grants at all.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

-- A signed-in user may read all columns of only the row allowed by the SELECT
-- policy. Explicitly naming columns keeps this safe if sensitive columns are
-- added later.
grant select (
  id,
  display_name,
  country,
  preferred_language,
  role,
  avatar_url,
  bio,
  created_at,
  updated_at
) on table public.profiles to authenticated;

-- Do not grant INSERT or DELETE. A database trigger creates the initial row.
-- Do not grant UPDATE on id, role, created_at, or updated_at.
grant update (
  display_name,
  country,
  preferred_language,
  avatar_url,
  bio
) on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No INSERT or DELETE policy is created. RLS therefore denies those operations
-- to authenticated and anon requests, even if a future table grant is added by
-- mistake.

-- The trigger updates this system-managed timestamp only when a client updates
-- one of the permitted profile fields. Clients have no UPDATE privilege on
-- updated_at itself.
create function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_profiles_updated_at() from public;
revoke all on function public.set_profiles_updated_at() from anon;
revoke all on function public.set_profiles_updated_at() from authenticated;

create trigger profiles_set_updated_at
before update of display_name, country, preferred_language, avatar_url, bio
on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- Create the minimum private profile when Supabase Auth creates an account.
-- SECURITY DEFINER is necessary because the auth transaction is not a browser
-- Data API request and authenticated users intentionally have no INSERT grant.
-- A fixed empty search_path plus fully-qualified relations prevents search-path
-- hijacking. Do not read raw_user_meta_data for role or authorization decisions.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, preferred_language)
  values (new.id, 'member', 'en')
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Important operational note:
-- An exception in handle_new_user() aborts the auth.users insert and therefore
-- the signup. This is intentional to preserve the 1:1 invariant. Apply first
-- in a test project and run the accompanying read-only verification queries.
