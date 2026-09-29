-- Sprint 7 DRAFT. Human review and isolated role-matrix tests BEFORE application.
-- Additive only; no existing policies, profiles, Auth or production rows changed.
begin;

create function public.community_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.community_is_admin() from public, anon;
grant execute on function public.community_is_admin() to authenticated;

-- Each upload gets a database-generated namespace, not a user UUID in public URLs.
create table public.community_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.community_uploads enable row level security;
revoke all on public.community_uploads from public, anon, authenticated;
grant select(id), insert(owner_id) on public.community_uploads to authenticated;
create policy community_uploads_own_read on public.community_uploads for select to authenticated using (owner_id = (select auth.uid()));
create policy community_uploads_own_create on public.community_uploads for insert to authenticated with check (owner_id = (select auth.uid()));

create function public.community_owns_uploaded_image(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.community_uploads u
    join storage.objects o on o.bucket_id='community-media' and o.name=u.id::text || '/image.webp'
    where u.id=target and u.owner_id=auth.uid());
$$;
revoke all on function public.community_owns_uploaded_image(uuid) from public, anon;
grant execute on function public.community_owns_uploaded_image(uuid) to authenticated;

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('moment','story','tip')),
  title text check (title is null or (char_length(regexp_replace(title, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 2 and 160 and title ~ '[^[:space:]]')),
  body text not null check (char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 2 and 10000 and body ~ '[^[:space:]]'),
  image_id uuid unique references public.community_uploads(id) on delete cascade,
  image_alt text check (image_alt is null or char_length(image_alt) <= 240),
  location_label text check (location_label is null or char_length(location_label) <= 120),
  topic text check (topic in ('transport','food','culture','shopping','language','safety','other')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check ((type = 'moment' and image_id is not null and char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) <= 500)
    or (type = 'story' and title is not null and char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) >= 20)
    or (type = 'tip' and title is not null and topic is not null and char_length(regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 10 and 5000)),
  check ((status = 'approved' and published_at is not null) or (status <> 'approved' and published_at is null)),
  check (not is_featured or status = 'approved')
);
alter table public.community_posts enable row level security;
revoke all on public.community_posts from public, anon, authenticated;
grant select(id,type,title,body,image_id,image_alt,location_label,topic,status,is_featured,published_at) on public.community_posts to anon, authenticated;
grant select(created_at,updated_at) on public.community_posts to authenticated;
grant insert(author_id,type,title,body,image_id,image_alt,location_label,topic) on public.community_posts to authenticated;
grant update(status,is_featured) on public.community_posts to authenticated;
create policy community_posts_public on public.community_posts for select to anon, authenticated using (status = 'approved');
create policy community_posts_own on public.community_posts for select to authenticated using (author_id = (select auth.uid()));
create policy community_posts_admin_read on public.community_posts for select to authenticated using ((select public.community_is_admin()));
create policy community_posts_insert on public.community_posts for insert to authenticated with check (
  author_id = (select auth.uid()) and status = 'pending' and not is_featured and published_at is null
  and (image_id is null or public.community_owns_uploaded_image(image_id))
);
create policy community_posts_admin_update on public.community_posts for update to authenticated
using ((select public.community_is_admin()) and status in ('pending','approved'))
with check ((select public.community_is_admin()) and status in ('approved','rejected'));

create function public.community_post_transition() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'pending' and new.status in ('approved','rejected') then
    new.published_at = case when new.status = 'approved' then pg_catalog.statement_timestamp() else null end;
    new.is_featured = false;
  elsif old.status = 'approved' and new.status = 'approved' then
    new.published_at = old.published_at;
  else
    raise exception 'Invalid moderation transition' using errcode = '23514';
  end if;
  new.updated_at = pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.community_post_transition() from public, anon, authenticated;
create trigger community_posts_transition before update on public.community_posts for each row execute function public.community_post_transition();
create index community_posts_public_idx on public.community_posts(published_at desc,id) where status = 'approved';
create index community_posts_own_idx on public.community_posts(author_id,created_at desc);
create index community_posts_queue_idx on public.community_posts(status,created_at,id);

-- Private bucket: no public object URLs. Uploads are insert-only, never overwrite.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('community-media','community-media',false,2097152,array['image/webp']);
-- Narrow predicates avoid storage.objects <-> posts RLS recursion and expose only
-- booleans. No caller-supplied identity. SQL object names fully qualified.
create function public.community_media_allowed(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.community_uploads u
    where object_name = u.id::text || '/image.webp'
    and (
      u.owner_id = auth.uid()
      or exists (select 1 from public.profiles r where r.id = auth.uid() and r.role = 'admin')
      or exists (select 1 from public.community_posts p where p.image_id = u.id and p.status = 'approved')
    )
  );
$$;
revoke all on function public.community_media_allowed(text) from public;
grant execute on function public.community_media_allowed(text) to anon, authenticated;
create policy community_media_read on storage.objects for select to anon, authenticated
using (bucket_id = 'community-media' and public.community_media_allowed(name));
-- Restrictive guards prevent unrelated permissive bucket policies widening access.
create policy community_media_read_guard on storage.objects as restrictive for select to anon, authenticated
using (bucket_id <> 'community-media' or public.community_media_allowed(name));
-- No permissive INSERT policy for this bucket. Deny direct writes by ALL API
-- users (including authenticated admins), even if another bucket has broad grants.
-- Only the server-only secret-key writer bypasses RLS, after authenticating the
-- caller, verifying their registry namespace and re-encoding through Sharp.
create policy community_media_no_insert on storage.objects as restrictive for insert to anon, authenticated
with check (bucket_id <> 'community-media');
create policy community_media_no_update on storage.objects as restrictive for update to anon, authenticated
using (bucket_id <> 'community-media') with check (bucket_id <> 'community-media');
create policy community_media_no_delete on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'community-media');

create table public.community_helpful (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  member_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (post_id,member_id)
);
alter table public.community_helpful enable row level security;
revoke all on public.community_helpful from public, anon, authenticated;
grant select(post_id), insert(post_id), delete on public.community_helpful to authenticated;
create function public.community_can_help(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.community_posts where id = target and status = 'approved' and author_id <> auth.uid());
$$;
revoke all on function public.community_can_help(uuid) from public, anon;
grant execute on function public.community_can_help(uuid) to authenticated;
create policy community_helpful_own on public.community_helpful for select to authenticated using (member_id = (select auth.uid()));
create policy community_helpful_add on public.community_helpful for insert to authenticated with check (member_id = (select auth.uid()) and public.community_can_help(post_id));
create policy community_helpful_remove on public.community_helpful for delete to authenticated using (member_id = (select auth.uid()));
-- Aggregate only; no voter identity. Bounded array, approved targets only.
create function public.community_helpful_counts(targets uuid[]) returns table(post_id uuid, total bigint)
language sql stable security definer set search_path = '' as $$
  select p.id,count(h.member_id) from public.community_posts p left join public.community_helpful h on h.post_id=p.id
  where p.status='approved' and p.id=any(targets[1:60]) group by p.id;
$$;
revoke all on function public.community_helpful_counts(uuid[]) from public;
grant execute on function public.community_helpful_counts(uuid[]) to anon, authenticated;

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','inappropriate','personal_information','copyright','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  unique(post_id,reporter_id)
);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from public, anon, authenticated;
grant insert(post_id,reason,details), select(id,post_id,reason,details,status,created_at), update(status) on public.community_reports to authenticated;
create policy community_reports_add on public.community_reports for insert to authenticated with check (
  reporter_id=(select auth.uid()) and status='open' and exists (select 1 from public.community_posts p where p.id=post_id and p.status='approved')
);
create policy community_reports_admin_read on public.community_reports for select to authenticated using ((select public.community_is_admin()));
create policy community_reports_admin_resolve on public.community_reports for update to authenticated
using (status='open' and (select public.community_is_admin())) with check (status='resolved' and (select public.community_is_admin()));

-- Singleton: replace the active prompt atomically; no scheduling or seed prompt.
create table public.community_prompt (
  id boolean primary key default true check (id),
  prompt text not null check (char_length(btrim(prompt)) between 5 and 240 and prompt ~ '[^[:space:]]'),
  suggested_type text not null check (suggested_type in ('moment','story','tip'))
);
alter table public.community_prompt enable row level security;
revoke all on public.community_prompt from public, anon, authenticated;
grant select(id,prompt,suggested_type) on public.community_prompt to anon, authenticated;
grant insert(prompt,suggested_type), update(prompt,suggested_type) on public.community_prompt to authenticated;
create policy community_prompt_read on public.community_prompt for select to anon, authenticated using (true);
create policy community_prompt_insert on public.community_prompt for insert to authenticated with check ((select public.community_is_admin()));
create policy community_prompt_update on public.community_prompt for update to authenticated using ((select public.community_is_admin())) with check ((select public.community_is_admin()));

-- Own-only bounded union: existing answers/reviews intentionally prohibit
-- author_id SELECT even in WHERE. Do not widen those grants or RLS. This reviewed
-- definer RPC accepts NO user ID and projects NO identities/private profiles.
create function public.my_community_contributions() returns table(id uuid, kind text, title text, body text, status text, created_at timestamptz, is_featured boolean, target_id uuid)
language sql stable security definer set search_path = '' as $$
  select * from (
    select p.id,p.type kind,p.title,p.body,p.status,p.created_at,p.is_featured,p.id target_id from public.community_posts p where p.author_id=auth.uid()
    union all select q.id,'question',q.title,q.body,q.status,q.created_at,false,q.id from public.questions q where q.author_id=auth.uid()
    union all select a.id,'answer',null,a.body,a.status,a.created_at,false,a.question_id from public.answers a where a.author_id=auth.uid()
    union all select r.id,'review',null,r.body,r.status,r.created_at,false,r.place_id from public.reviews r where r.author_id=auth.uid()
  ) own_rows order by created_at desc,id limit 100;
$$;
revoke all on function public.my_community_contributions() from public, anon;
grant execute on function public.my_community_contributions() to authenticated;

-- Review/operations: no member content edit/delete, terminal approval immutable;
-- only approved feature toggle remains. No author display: profiles stay private.
-- Abandoned uploads stay private; operator cleanup via Storage API after retention
-- review (never SQL deletion from storage.objects). No automatic cleanup here.
-- Storage writes are server-only: store sanitized WebP, never member originals.
-- Approved anonymous reads expose only sanitized data. Owners/admins can preview
-- private images. No browser may bypass sanitization with a direct Storage write.
-- A privileged operator can still violate this invariant; never manually upload
-- original files to this bucket. No pre-existing objects are sanitized/backfilled.
-- Owners/BYPASSRLS remain privileged. Never distribute their credentials.
commit;
