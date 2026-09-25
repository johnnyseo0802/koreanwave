-- DRAFT: review and apply separately. No remote execution or seed data.
-- UUID detail URLs follow existing question/event conventions; no slug collisions.
begin;

create table public.editorial_articles (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  category text not null,
  title text not null check (char_length(btrim(title)) between 2 and 160 and title ~ '[^[:space:]]'),
  summary text not null check (char_length(btrim(summary)) between 10 and 500 and summary ~ '[^[:space:]]'),
  body text not null check (char_length(btrim(body)) between 20 and 30000 and body ~ '[^[:space:]]'),
  image_url text check (image_url is null or (char_length(image_url) <= 2048 and image_url ~ '^https://[^[:space:]]+$')),
  source_url text check (source_url is null or (char_length(source_url) <= 2048 and source_url ~ '^https://[^[:space:]]+$')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint editorial_articles_category_check check (
    (section = 'k-contents' and category in ('music', 'dramas', 'movies'))
    or (section = 'k-trends' and category in ('beauty', 'fashion', 'food'))
  ),
  constraint editorial_articles_publication_check check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
  )
);

alter table public.editorial_articles enable row level security;
revoke all on table public.editorial_articles from public, anon, authenticated;
-- status is selectable so PostgREST can filter it; there are no author identities.
grant select (id, section, category, title, summary, body, image_url, source_url, status, published_at)
  on public.editorial_articles to anon, authenticated;
-- Needed for optimistic concurrency in the admin editor; RLS still hides drafts.
grant select (updated_at) on public.editorial_articles to authenticated;
grant insert (section, category, title, summary, body, image_url, source_url, status)
  on public.editorial_articles to authenticated;
grant update (section, category, title, summary, body, image_url, source_url, status)
  on public.editorial_articles to authenticated;
-- No DELETE workflow in this sprint: deny to all API users, including admins.
-- No id/created_at/updated_at/published_at write grants, and no table-level UPDATE.

create policy "editorial_articles_public_read_published" on public.editorial_articles
for select to anon, authenticated using (status = 'published');
create policy "editorial_articles_admin_read_all" on public.editorial_articles
for select to authenticated using (exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
));
create policy "editorial_articles_admin_insert" on public.editorial_articles
for insert to authenticated with check (exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
));
create policy "editorial_articles_admin_update" on public.editorial_articles
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create function public.maintain_editorial_article_timestamps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = pg_catalog.statement_timestamp();
    new.updated_at = new.created_at;
  else
    new.created_at = old.created_at;
    -- Monotonic revision token, even for two writes in the same transaction.
    new.updated_at = greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;
  if new.status = 'published' then
    if tg_op = 'INSERT' then new.published_at = pg_catalog.statement_timestamp();
    elsif old.status = 'draft' then new.published_at = pg_catalog.statement_timestamp();
    else new.published_at = old.published_at;
    end if;
  else new.published_at = null;
  end if;
  return new;
end;
$$;
revoke all on function public.maintain_editorial_article_timestamps() from public, anon, authenticated;
create trigger editorial_articles_maintain_timestamps
before insert or update on public.editorial_articles
for each row execute function public.maintain_editorial_article_timestamps();

create index editorial_articles_public_category_idx
  on public.editorial_articles (section, category, published_at desc, id) where status = 'published';

-- Security/publishing review:
-- RLS uses the existing own-profile SELECT policy and protected profiles.role.
-- No SECURITY DEFINER, elevated key, user metadata, or existing policy changes.
-- Admin publication/unpublication is reversible. Published edits retain the date;
-- republishing starts a new date. No scheduling. Public reads must filter status.
-- Unpublication prevents future reads, not copies already received by visitors.
-- URL checks here reject non-HTTPS/whitespace. Application also rejects credentials,
-- local/private hosts and malformed URLs; it never server-fetches external images.
-- DELETE deliberately not granted; future deletion needs a separately reviewed change.
-- Owner/BYPASSRLS remains privileged; never expose those credentials in the app.
commit;

-- Read-only verification after separately approved deployment:
-- select policyname, cmd, qual, with_check from pg_catalog.pg_policies
-- where schemaname = 'public' and tablename = 'editorial_articles';
-- select grantee, column_name, privilege_type from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'editorial_articles';
-- In an isolated test environment verify anon/member draft denial, member writes
-- denied, admin draft/create/edit/publish/unpublish, timestamp forgery denied,
-- invalid category/lengths rejected, stale revision returning zero updated rows.
