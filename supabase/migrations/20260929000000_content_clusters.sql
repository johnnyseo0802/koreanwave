-- Sprint 8 draft. Forward-only; review and apply separately. No seeds or remote execution.
begin;

create table public.content_clusters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 2 and 160 and title ~ '[^[:space:]]'),
  summary text not null check (char_length(btrim(summary)) between 10 and 500 and summary ~ '[^[:space:]]'),
  introduction text not null check (char_length(btrim(introduction)) between 20 and 10000 and introduction ~ '[^[:space:]]'),
  status text not null default 'draft' check (status in ('draft','published')),
  display_order integer not null default 0 check (display_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check ((status = 'draft' and published_at is null) or (status = 'published' and published_at is not null))
);
-- Reuse the editorial timestamp trigger function: identical required fields.
-- Published edits retain date; unpublish clears it; republish starts a new date.
create trigger content_clusters_timestamps before insert or update on public.content_clusters
for each row execute function public.maintain_editorial_article_timestamps();

create table public.content_cluster_items (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.content_clusters(id) on delete cascade,
  article_id uuid references public.editorial_articles(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  experience_id uuid references public.experiences(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  community_post_id uuid references public.community_posts(id) on delete cascade,
  display_order integer not null default 0 check (display_order between 0 and 9999),
  constraint content_cluster_items_exactly_one_target check (num_nonnulls(article_id,place_id,experience_id,event_id,question_id,community_post_id) = 1)
);
create unique index content_cluster_items_article_id_unique on public.content_cluster_items(cluster_id,article_id) where article_id is not null;
create unique index content_cluster_items_place_id_unique on public.content_cluster_items(cluster_id,place_id) where place_id is not null;
create unique index content_cluster_items_experience_id_unique on public.content_cluster_items(cluster_id,experience_id) where experience_id is not null;
create unique index content_cluster_items_event_id_unique on public.content_cluster_items(cluster_id,event_id) where event_id is not null;
create unique index content_cluster_items_question_id_unique on public.content_cluster_items(cluster_id,question_id) where question_id is not null;
create unique index content_cluster_items_community_post_id_unique on public.content_cluster_items(cluster_id,community_post_id) where community_post_id is not null;
create index content_cluster_items_order_idx on public.content_cluster_items(cluster_id,display_order,id);
create table public.content_cluster_prompts (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.content_clusters(id) on delete cascade,
  kind text not null check (kind in ('question','moment','story','tip')),
  prompt text not null check (char_length(btrim(prompt)) between 5 and 500 and prompt ~ '[^[:space:]]'),
  display_order integer not null default 0 check (display_order between 0 and 9999),
  unique(cluster_id,kind,prompt)
);
create index content_cluster_prompts_order_idx on public.content_cluster_prompts(cluster_id,display_order,id);
create index content_clusters_public_order_idx on public.content_clusters(display_order,id) where status='published';

alter table public.content_clusters enable row level security;
revoke all on public.content_clusters from public, anon, authenticated;
alter table public.content_cluster_items enable row level security;
revoke all on public.content_cluster_items from public, anon, authenticated;
alter table public.content_cluster_prompts enable row level security;
revoke all on public.content_cluster_prompts from public, anon, authenticated;
grant select(id,slug,title,summary,introduction,status,display_order,published_at) on public.content_clusters to anon, authenticated;
grant select(updated_at) on public.content_clusters to authenticated;
grant insert(slug,title,summary,introduction,status,display_order), update(slug,title,summary,introduction,status,display_order) on public.content_clusters to authenticated;
grant select(id,cluster_id,article_id,place_id,experience_id,event_id,question_id,community_post_id,display_order) on public.content_cluster_items to anon, authenticated;
grant insert(cluster_id,article_id,place_id,experience_id,event_id,question_id,community_post_id,display_order), update(display_order) on public.content_cluster_items to authenticated;
grant select(id,cluster_id,kind,prompt,display_order) on public.content_cluster_prompts to anon, authenticated;
grant insert(cluster_id,kind,prompt,display_order), update(kind,prompt,display_order) on public.content_cluster_prompts to authenticated;
-- Removing a relationship/prompt never deletes its target. Cluster deletion not granted.
grant delete on public.content_cluster_items, public.content_cluster_prompts to authenticated;

create policy clusters_public_published on public.content_clusters for select to anon, authenticated using (status='published');
-- Explicit status checks are necessary even where target RLS allows own/private reads.
create policy cluster_items_public_targets on public.content_cluster_items for select to anon, authenticated using (
  exists(select 1 from public.content_clusters c where c.id=cluster_id and c.status='published')
  and (
    exists(select 1 from public.editorial_articles t where t.id=article_id and t.status='published')
    or     exists(select 1 from public.places t where t.id=place_id and t.status='published')
    or     exists(select 1 from public.experiences t where t.id=experience_id and t.status='published')
    or     exists(select 1 from public.events t where t.id=event_id and t.status='published')
    or     exists(select 1 from public.questions t where t.id=question_id and t.status='approved')
    or     exists(select 1 from public.community_posts t where t.id=community_post_id and t.status='approved')
  )
);
create policy cluster_prompts_public on public.content_cluster_prompts for select to anon, authenticated using (
  exists(select 1 from public.content_clusters c where c.id=cluster_id and c.status='published')
);

create policy content_clusters_admin_read on public.content_clusters for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_clusters_admin_insert on public.content_clusters for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_clusters_admin_update on public.content_clusters for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create policy content_cluster_items_admin_read on public.content_cluster_items for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_cluster_items_admin_insert on public.content_cluster_items for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_cluster_items_admin_update on public.content_cluster_items for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_cluster_items_admin_delete on public.content_cluster_items for delete to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create policy content_cluster_prompts_admin_read on public.content_cluster_prompts for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_cluster_prompts_admin_insert on public.content_cluster_prompts for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_cluster_prompts_admin_update on public.content_cluster_prompts for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy content_cluster_prompts_admin_delete on public.content_cluster_prompts for delete to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

-- Existing timestamp triggers own all timestamps. No Event creation or UGC changes.
grant insert(name,area,category,description,visitor_info,status,image_url,image_alt) on public.places to authenticated;
create policy places_admin_create on public.places for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

-- Existing timestamp triggers own all timestamps. No Event creation or UGC changes.
grant insert(name,area,category,description,visitor_info,status,image_url,image_alt) on public.experiences to authenticated;
create policy experiences_admin_create on public.experiences for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

-- No SECURITY DEFINER helper, secret, new Storage policy or data backfill.
-- Public app queries must independently enforce all target status filters, including
-- when an administrator visits a public page. Do not serialize raw relationship rows.
commit;

-- Review on isolated DB before applying: anon/member/admin matrix; published cluster
-- linked to each private target remains invisible incl UUID/count; target unpublish
-- hides relationship immediately; duplicate/exactly-one checks; timestamp forgery;
-- member local INSERT denial, admin INSERT success, Events INSERT still denied.
-- Rollback: disable new routes first; separately review retention and revocation.
-- Do not drop content or undo existing migrations as an automated rollback.
