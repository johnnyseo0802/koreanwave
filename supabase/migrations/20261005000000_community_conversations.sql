-- Sprint 9.1 REVIEW DRAFT: real-time comments, moderation by exception.
-- Replaces the UNAPPLIED Sprint 9 draft. Never apply automatically; no seeds.
begin;

-- Helpers live outside the Data API's exposed schemas. Public RPCs below are
-- invokers with fixed signatures; do not add conversation_private to exposed schemas.
create schema conversation_private;
revoke all on schema conversation_private from public;
grant usage on schema conversation_private to anon, authenticated;

alter table public.community_posts drop constraint community_posts_type_check,
  add constraint community_posts_type_check check(type in ('moment','story','tip','discussion'));
-- PostgreSQL assigns this name to the first unnamed table-level CHECK in Sprint 7.
-- Fail/rollback rather than guessing a different production constraint.
alter table public.community_posts drop constraint community_posts_check,
  add constraint community_posts_check check (
    (type='moment' and image_id is not null and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g'))<=500)
    or (type='story' and title is not null and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g'))>=20)
    or (type='tip' and title is not null and topic is not null and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g')) between 10 and 5000)
    or (type='discussion' and title is not null and image_id is null and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g')) between 2 and 2000)
  );
-- Operator-created discussion prompts only. Existing member contributions unchanged.
create policy community_discussion_operator_only on public.community_posts as restrictive
for insert to authenticated with check(type<>'discussion' or (select public.community_is_admin()));

-- Published abusive content may be hidden permanently by admin; no restore/edit path.
create or replace function public.community_post_transition() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.status in ('pending','approved') and new.status='rejected' then
   new.published_at=null; new.is_featured=false;
 elsif old.status='pending' and new.status='approved' then
   new.published_at=pg_catalog.statement_timestamp(); new.is_featured=false;
 elsif old.status='approved' and new.status='approved' then new.published_at=old.published_at;
 else raise exception 'Invalid moderation transition' using errcode='23514'; end if;
 new.updated_at=pg_catalog.clock_timestamp(); return new;
end; $$;
-- Existing function ACL, grants and admin UPDATE policies are retained.

create table public.community_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts(id) on delete cascade,
 parent_comment_id uuid,
 author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 body text not null check(char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g')) between 2 and 2000 and body ~ '[^[:space:]]'),
 status text not null default 'approved' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 unique(id,post_id),
 foreign key(parent_comment_id,post_id) references public.community_comments(id,post_id) on delete cascade,
 check(parent_comment_id is null or parent_comment_id<>id),
 check((status='approved' and published_at is not null) or (status<>'approved' and published_at is null))
);
alter table public.community_comments enable row level security;
revoke all on public.community_comments from public,anon,authenticated;
grant select(id,post_id,parent_comment_id,body,status,created_at,published_at) on public.community_comments to anon,authenticated;
grant insert(post_id,parent_comment_id,body), update(status) on public.community_comments to authenticated;

create function conversation_private.comment_context(post uuid,parent uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.community_posts p where p.id=post and p.status='approved')
 and (parent is null or exists(select 1 from public.community_comments c
 where c.id=parent and c.post_id=post and c.parent_comment_id is null and c.status='approved'));
$$;
revoke all on function conversation_private.comment_context(uuid,uuid) from public;
grant execute on function conversation_private.comment_context(uuid,uuid) to anon,authenticated;
create policy comments_public on public.community_comments for select to anon,authenticated
using(status='approved' and conversation_private.comment_context(post_id,parent_comment_id));
-- Own pending/rejected rows are visible only while the public parent context is valid.
-- This avoids private parent references/content escaping after moderation/deletion.
create policy comments_own on public.community_comments for select to authenticated
using(author_id=(select auth.uid()) and conversation_private.comment_context(post_id,parent_comment_id));
create policy comments_admin on public.community_comments for select to authenticated using((select public.community_is_admin()));
create policy comments_submit on public.community_comments for insert to authenticated
with check(author_id=(select auth.uid()) and status='approved' and published_at is not null
 and conversation_private.comment_context(post_id,parent_comment_id));
create policy comments_moderate on public.community_comments for update to authenticated
using((select public.community_is_admin()) and status in ('pending','approved'))
with check((select public.community_is_admin()) and status in ('approved','rejected'));

create function conversation_private.comment_transition() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   -- Lock target rows to serialize concurrent hiding vs submission. All accepted
   -- replies point to approved roots in the same approved post. No third level.
   perform 1 from public.community_posts p where p.id=new.post_id and p.status='approved' for share;
   if not found then raise exception 'Unavailable conversation' using errcode='23514'; end if;
   if new.parent_comment_id is not null then
     perform 1 from public.community_comments c where c.id=new.parent_comment_id and c.post_id=new.post_id
       and c.parent_comment_id is null and c.status='approved' for share;
     if not found then raise exception 'Unavailable conversation' using errcode='23514'; end if;
   end if;
   -- Modest burst limit, serialised per member. Does not claim Sybil resistance.
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.author_id::text,9));
   if (select count(*) from public.community_comments where author_id=new.author_id and created_at>now()-interval '1 minute')>=5 then
     raise exception 'Please wait before contributing again' using errcode='23514'; end if;
   new.created_at=pg_catalog.statement_timestamp();new.updated_at=new.created_at;
   -- BEFORE INSERT owns publication, before RLS WITH CHECK runs. No client can
   -- insert status or dates. Pending remains reserved for a future reviewed hold
   -- mechanism; no caller metadata/role/classifier decision is trusted today.
   new.status='approved';new.published_at=new.created_at;
 else
   if old.status='pending' and new.status='approved' then
     if not conversation_private.comment_context(new.post_id,new.parent_comment_id) then raise exception 'Unavailable conversation' using errcode='23514'; end if;
     new.published_at=pg_catalog.statement_timestamp();
   elsif old.status in ('pending','approved') and new.status='rejected' then new.published_at=null;
   else raise exception 'Invalid moderation transition' using errcode='23514'; end if;
   new.updated_at=pg_catalog.clock_timestamp();
 end if;
 return new;
end; $$;
revoke all on function conversation_private.comment_transition() from public,anon,authenticated;
create trigger community_comments_transition before insert or update on public.community_comments for each row execute function conversation_private.comment_transition();
create index community_comments_thread_idx on public.community_comments(post_id,created_at,id);
create index community_comments_own_idx on public.community_comments(author_id,created_at desc);
create index community_comments_queue_idx on public.community_comments(status,created_at);
create index community_comments_parent_idx on public.community_comments(parent_comment_id,post_id);

-- Reuse Helpful storage and own-only policies; keep old Helpful semantics.
alter table public.community_helpful add column reaction_type text not null default 'helpful'
 check(reaction_type in ('helpful','like','interesting','agree'));
-- Unknown historical reaction times must not masquerade as recent participation.
alter table public.community_helpful add column created_at timestamptz not null default '1970-01-01T00:00:00Z';
alter table public.community_helpful alter column created_at set default now();
alter table public.community_helpful drop constraint community_helpful_pkey,
 add primary key(post_id,member_id,reaction_type);
grant select(reaction_type),insert(reaction_type) on public.community_helpful to authenticated;
create index community_reactions_recent_idx on public.community_helpful(created_at,post_id);
create or replace function public.community_helpful_counts(targets uuid[]) returns table(post_id uuid,total bigint)
language sql stable security definer set search_path='' as $$
 select p.id,count(h.member_id) from public.community_posts p left join public.community_helpful h
 on h.post_id=p.id and h.reaction_type='helpful'
 where p.status='approved' and p.id=any(targets[1:60]) group by p.id;
$$;

-- Reports reuse the existing privacy, reason vocabulary and admin workflow.
alter table public.community_reports add column comment_id uuid;
alter table public.community_reports add constraint community_reports_comment_fk foreign key(comment_id,post_id)
 references public.community_comments(id,post_id) on delete cascade;
alter table public.community_reports drop constraint community_reports_post_id_reporter_id_key;
create unique index community_reports_post_once on public.community_reports(post_id,reporter_id) where comment_id is null;
create unique index community_reports_comment_once on public.community_reports(comment_id,reporter_id) where comment_id is not null;
grant select(comment_id),insert(comment_id) on public.community_reports to authenticated;
create policy community_reports_comment_guard on public.community_reports as restrictive for insert to authenticated
with check(comment_id is null or exists(select 1 from public.community_comments c where c.id=comment_id and c.post_id=community_reports.post_id
 and c.status='approved' and conversation_private.comment_context(c.post_id,c.parent_comment_id)));

create table public.article_discussions (
 article_id uuid primary key references public.editorial_articles(id) on delete cascade,
 post_id uuid not null references public.community_posts(id) on delete cascade
);
alter table public.article_discussions enable row level security;
revoke all on public.article_discussions from public,anon,authenticated;
grant select(article_id,post_id) on public.article_discussions to anon,authenticated;
grant insert(article_id,post_id),update(post_id),delete on public.article_discussions to authenticated;
create policy article_discussions_public on public.article_discussions for select to anon,authenticated using(
 exists(select 1 from public.editorial_articles a where a.id=article_id and a.status='published')
 and exists(select 1 from public.community_posts p where p.id=post_id and p.type='discussion' and p.status='approved'));
create policy article_discussions_admin_read on public.article_discussions for select to authenticated using((select public.community_is_admin()));
create policy article_discussions_admin_insert on public.article_discussions for insert to authenticated with check((select public.community_is_admin()) and exists(select 1 from public.community_posts p where p.id=post_id and p.type='discussion'));
create policy article_discussions_admin_update on public.article_discussions for update to authenticated using((select public.community_is_admin())) with check((select public.community_is_admin()) and exists(select 1 from public.community_posts p where p.id=post_id and p.type='discussion'));
create policy article_discussions_admin_delete on public.article_discussions for delete to authenticated using((select public.community_is_admin()));
create index article_discussions_post_idx on public.article_discussions(post_id);

-- No identity leaves this aggregate projection. Status checks ignore caller's
-- potentially broader admin/owner visibility. Distinct participants cap each
-- account to ONE recent ranking contribution across comments and reaction types.
create function conversation_private.activity() returns table(post_id uuid,comments bigint,reactions bigint,participants bigint,last_activity timestamptz,score numeric)
language sql stable security definer set search_path='' as $$
 with visible as (select p.id,p.author_id,p.published_at from public.community_posts p where p.status='approved'),
 c as (select c.* from public.community_comments c join visible p on p.id=c.post_id where c.status='approved'
   and (c.parent_comment_id is null or exists(select 1 from public.community_comments root where root.id=c.parent_comment_id and root.post_id=c.post_id and root.status='approved' and root.parent_comment_id is null))),
 recent as (
 select c.post_id,c.author_id member_id from c join visible p on p.id=c.post_id where c.published_at>now()-interval '7 days' and c.author_id<>p.author_id
 union select r.post_id,r.member_id from public.community_helpful r join visible p on p.id=r.post_id where r.created_at>now()-interval '7 days' and r.member_id<>p.author_id),
 totals as (select p.id, (select count(*) from c where c.post_id=p.id) comments,
 (select count(*) from public.community_helpful r where r.post_id=p.id) reactions,
 (select count(*) from recent r where r.post_id=p.id) participants,
 greatest(p.published_at,(select max(c.published_at) from c where c.post_id=p.id)) last_activity from visible p)
 select t.id,t.comments,t.reactions,t.participants,t.last_activity,
 (least(t.participants,50)*3 + case when t.last_activity>now()-interval '2 days' then 1 else 0 end)::numeric
 /(1+greatest(0,extract(epoch from (now()-t.last_activity)))/172800) score from totals t;
$$;
revoke all on function conversation_private.activity() from public;
grant execute on function conversation_private.activity() to anon,authenticated;
create function public.conversation_activity(targets uuid[]) returns table(post_id uuid,comments bigint,reactions bigint,participants bigint,last_activity timestamptz,score numeric)
language sql stable security invoker set search_path='' as $$
 select * from conversation_private.activity() a where a.post_id=any(targets[1:60]);
$$;
revoke all on function public.conversation_activity(uuid[]) from public;
grant execute on function public.conversation_activity(uuid[]) to anon,authenticated;
create function public.trending_conversations() returns table(post_id uuid,comments bigint,reactions bigint,participants bigint,last_activity timestamptz,score numeric)
language sql stable security invoker set search_path='' as $$
 select * from conversation_private.activity() a order by a.score desc,a.last_activity desc,a.post_id limit 30;
$$;
revoke all on function public.trending_conversations() from public;
grant execute on function public.trending_conversations() to anon,authenticated;

create function conversation_private.reaction_counts(target uuid) returns table(kind text,total bigint)
language sql stable security definer set search_path='' as $$
 select r.reaction_type,count(*) from public.community_helpful r join public.community_posts p on p.id=r.post_id
 where p.id=target and p.status='approved' group by r.reaction_type;
$$;
revoke all on function conversation_private.reaction_counts(uuid) from public;
grant execute on function conversation_private.reaction_counts(uuid) to anon,authenticated;
create function public.conversation_reaction_counts(target uuid) returns table(kind text,total bigint)
language sql stable security invoker set search_path='' as $$select * from conversation_private.reaction_counts(target);$$;
revoke all on function public.conversation_reaction_counts(uuid) from public;
grant execute on function public.conversation_reaction_counts(uuid) to anon,authenticated;
-- Own contribution state without permitting author_id filtering/projection.
create function conversation_private.own_comments(target uuid) returns table(id uuid,parent_comment_id uuid,body text,status text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select c.id,c.parent_comment_id,c.body,c.status,c.created_at from public.community_comments c
 where c.post_id=target and c.author_id=auth.uid() and conversation_private.comment_context(c.post_id,c.parent_comment_id)
 order by c.created_at desc,c.id limit 50;
$$;
revoke all on function conversation_private.own_comments(uuid) from public,anon;
grant execute on function conversation_private.own_comments(uuid) to authenticated;
create function public.my_conversation_comments(target uuid) returns table(id uuid,parent_comment_id uuid,body text,status text,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from conversation_private.own_comments(target);$$;
revoke all on function public.my_conversation_comments(uuid) from public,anon;
grant execute on function public.my_conversation_comments(uuid) to authenticated;

-- Deletion of a post/auth user cascades its comments/replies and reports; no API
-- member DELETE grant. Hiding a root hides its reply subtree without exposing IDs.
-- No public profile fields, emails or auth IDs. No Storage/Auth/profile changes.
-- Reruns intentionally fail at schema/table creation. Review first; no DROP table.
commit;
