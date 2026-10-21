-- LOCAL REVIEW DRAFT. Not applied to Production. Requires matching application.
-- Do not combine with the older, unapplied Moments-only migrations.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create schema member_content_private;
revoke all on schema member_content_private from public;
grant usage on schema member_content_private to anon,authenticated;

-- Whitelisted relation names only; no caller-supplied SQL identifiers.
create function member_content_private.relation(kind text) returns text
language sql immutable security invoker set search_path='' as $$
 select case kind when 'post' then 'community_posts' when 'comment' then 'community_comments'
 when 'question' then 'questions' when 'answer' then 'answers' when 'review' then 'reviews' end
$$;
revoke all on function member_content_private.relation(text) from public;

do $$ declare t text; c record; n integer; begin
 foreach t in array array['community_posts','community_comments','questions','answers','reviews'] loop
  execute format('alter table public.%I add column edited_at timestamptz, add column deleted_at timestamptz, add column revision bigint not null default 1 check(revision>0)',t);
  -- Preserve historical publication time across re-review/hiding. Fail rather
  -- than guessing if the expected original publication constraint has drifted.
  n:=0;
  for c in select conname from pg_constraint where conrelid=format('public.%I',t)::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%published_at%' and pg_get_constraintdef(oid) like '%status%' loop
   n:=n+1; execute format('alter table public.%I drop constraint %I',t,c.conname);
  end loop;
  if n<>1 then raise exception 'Unexpected publication constraint baseline'; end if;
  execute format('alter table public.%I add constraint member_publication_check check(status<>''approved'' or published_at is not null)',t);
  execute format('alter table public.%I add constraint member_deleted_check check(deleted_at is null or status=''rejected'')',t);
  execute format('grant select(edited_at,revision) on public.%I to anon,authenticated',t);
  -- Column grants from the old moderator still exist: restrictive UPDATE is
  -- therefore essential, including against old browser sessions and direct REST.
  execute format('create policy member_no_direct_update on public.%I as restrictive for update to anon,authenticated using(false) with check(false)',t);
  execute format('create policy member_not_deleted on public.%I as restrictive for select to anon,authenticated using(deleted_at is null)',t);
 end loop;
end $$;

create function member_content_private.alive(kind text,target uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare t text:=member_content_private.relation(kind); r jsonb;
begin
 if t is null or target is null then return false; end if;
 execute format('select to_jsonb(p) from public.%I p where id=$1 and deleted_at is null',t) into r using target;
 if r is null then return false; end if;
 if kind='answer' then return member_content_private.alive('question',(r->>'question_id')::uuid); end if;
 if kind='comment' then return member_content_private.alive('post',(r->>'post_id')::uuid)
   and ((r->>'parent_comment_id') is null or member_content_private.alive('comment',(r->>'parent_comment_id')::uuid)); end if;
 return true;
end $$;
revoke all on function member_content_private.alive(text,uuid) from public;
grant execute on function member_content_private.alive(text,uuid) to anon,authenticated;
create policy member_answer_parent on public.answers as restrictive for select to anon,authenticated
 using(member_content_private.alive('question',question_id));
create policy member_comment_parent on public.community_comments as restrictive for select to anon,authenticated
 using(member_content_private.alive('post',post_id) and (parent_comment_id is null or member_content_private.alive('comment',parent_comment_id)));
create policy member_report_parent on public.community_reports as restrictive for select to authenticated
 using(member_content_private.alive('post',post_id) and (comment_id is null or member_content_private.alive('comment',comment_id)));
create policy member_reaction_parent on public.community_helpful as restrictive for select to authenticated
 using(member_content_private.alive('post',post_id));
create policy member_article_discussion_parent on public.article_discussions as restrictive for select to anon,authenticated
 using(member_content_private.alive('post',post_id));
create policy member_cluster_parent on public.content_cluster_items as restrictive for select to anon,authenticated
 using((community_post_id is null or member_content_private.alive('post',community_post_id)) and (question_id is null or member_content_private.alive('question',question_id)));

-- Changed YouTube metadata requires a recent server verification, including when
-- the owner invokes the public RPC directly. No URL, iframe or caller HTML stored.
create table member_content_private.verified_videos (
 video_id text primary key check(video_id ~ '^[A-Za-z0-9_-]{11}$'),
 title text not null check(char_length(btrim(title)) between 1 and 300),
 channel text not null check(char_length(btrim(channel)) between 1 and 200),
 checked_at timestamptz not null default now()
);
alter table member_content_private.verified_videos enable row level security;
revoke all on member_content_private.verified_videos from public,anon,authenticated;
create function public.register_verified_member_video(video_id text,title text,channel text) returns void
language sql security definer set search_path='' as $$
 insert into member_content_private.verified_videos values(video_id,title,channel,clock_timestamp())
 on conflict(video_id) do update set title=excluded.title,channel=excluded.channel,checked_at=excluded.checked_at
$$;
revoke all on function public.register_verified_member_video(text,text,text) from public,anon,authenticated;
grant execute on function public.register_verified_member_video(text,text,text) to service_role;

-- Durable, private cleanup receipts. No text or user identity is returned to a
-- browser. Retiring an image immediately removes registry/download visibility.
create table member_content_private.retired_media (
 -- Deliberately no cascading FK: an infrastructure-level account erasure must
 -- neither be blocked by this queue nor erase an outstanding cleanup receipt.
 image_id uuid primary key,
 post_id uuid not null,
 requested_at timestamptz not null default now(), removed_at timestamptz
);
alter table member_content_private.retired_media enable row level security;
revoke all on member_content_private.retired_media from public,anon,authenticated;
create function member_content_private.image_active(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select target is not null and not exists(select 1 from member_content_private.retired_media where image_id=target)
 and not exists(select 1 from public.community_posts where image_id=target and deleted_at is not null)
$$;
revoke all on function member_content_private.image_active(uuid) from public;
grant execute on function member_content_private.image_active(uuid) to anon,authenticated;
-- Do NOT re-read the newly inserted registry row: INSERT RETURNING must work.
create policy member_upload_active on public.community_uploads as restrictive for select to authenticated
 using(member_content_private.image_active(id));
create or replace function public.community_media_allowed(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.community_uploads u where object_name=u.id::text||'/image.webp'
 and member_content_private.image_active(u.id) and (u.owner_id=auth.uid()
 or exists(select 1 from public.profiles where id=auth.uid() and role='admin')
 or exists(select 1 from public.community_posts p where p.image_id=u.id and p.status='approved' and p.deleted_at is null)))
$$;
create or replace function public.community_owns_uploaded_image(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select member_content_private.image_active(target) and exists(select 1 from public.community_uploads u
 join storage.objects o on o.bucket_id='community-media' and o.name=u.id::text||'/image.webp'
 where u.id=target and u.owner_id=auth.uid())
$$;
-- The app downloads through its authenticated, sanitizing proxy; it does not
-- need signed URLs. Both hosted GET operations are required. Other buckets keep
-- their existing policies. Existing issued URLs/cache are NOT revoked by RLS.
create policy member_media_download_only on storage.objects as restrictive for select to anon,authenticated
 using(bucket_id<>'community-media' or storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info']));

-- Retain INSERT comment moderation/rate-limit trigger, replace UPDATE lifecycle.
drop trigger community_comments_transition on public.community_comments;
create trigger community_comments_transition before insert on public.community_comments for each row execute function conversation_private.comment_transition();
drop trigger community_posts_transition on public.community_posts;
drop trigger questions_enforce_moderation_transition on public.questions;
drop trigger answers_enforce_moderation_transition on public.answers;
drop trigger reviews_enforce_moderation_transition on public.reviews;

create function member_content_private.transition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a jsonb:=to_jsonb(old); b jsonb:=to_jsonb(new); changed boolean;
 fields text[]:=array['title','body','image_id','image_alt','location_label','topic','youtube_video_id','youtube_title','youtube_channel_name'];
begin
 if old.deleted_at is not null then raise exception 'Unavailable content' using errcode='42501'; end if;
 if (a-fields-array['status','is_featured','published_at','updated_at','edited_at','deleted_at','revision'])
  is distinct from (b-fields-array['status','is_featured','published_at','updated_at','edited_at','deleted_at','revision'])
 then raise exception 'Immutable content identity' using errcode='42501'; end if;
 changed:=(select jsonb_object_agg(key,value) from jsonb_each(a) where key=any(fields))
  is distinct from (select jsonb_object_agg(key,value) from jsonb_each(b) where key=any(fields));
 new.edited_at:=old.edited_at; new.published_at:=old.published_at;
 if new.deleted_at is not null then
  if old.author_id is distinct from auth.uid() or changed then raise exception 'Owner required' using errcode='42501'; end if;
  new.deleted_at:=clock_timestamp(); new.status:='rejected';
 elsif changed then
  if old.author_id is distinct from auth.uid() or old.status not in ('pending','approved') then raise exception 'Not editable' using errcode='42501'; end if;
  new.edited_at:=clock_timestamp();
  new.status:=case when tg_table_name='community_comments' then old.status else 'pending' end;
 else
  if not public.community_is_admin() or old.status not in ('pending','approved') or new.status not in ('approved','rejected') then
   raise exception 'Invalid moderation' using errcode='42501'; end if;
  if new.status='approved' then new.published_at:=coalesce(old.published_at,statement_timestamp()); end if;
 end if;
 if tg_table_name='community_posts' then
  if new.status<>'approved' then new.is_featured:=false; end if;
  if old.image_id is not null and (new.deleted_at is not null or new.image_id is distinct from old.image_id) then
   insert into member_content_private.retired_media(image_id,post_id) values(old.image_id,old.id) on conflict do nothing;
  end if;
 end if;
 new.revision:=old.revision+1; new.updated_at:=clock_timestamp(); return new;
end $$;
revoke all on function member_content_private.transition() from public,anon,authenticated;
do $$ declare t text; begin foreach t in array array['community_posts','community_comments','questions','answers','reviews'] loop
 execute format('create trigger member_transition before update on public.%I for each row execute function member_content_private.transition()',t);
end loop; end $$;

-- All normal owner/admin writes lock the same row and compare the displayed
-- revision. No request-supplied identity, role, publication date or edit date.
create function member_content_private.mutate(kind text,target uuid,expected_revision bigint,operation text,patch jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t text:=member_content_private.relation(kind); r jsonb; next_row jsonb; fields text[]; assignments text; k text; changed boolean;
begin
 if auth.uid() is null or t is null or expected_revision<1 or expected_revision is null or patch is null or jsonb_typeof(patch)<>'object' then
  raise exception 'Invalid request' using errcode='42501'; end if;
 execute format('select to_jsonb(p) from public.%I p where id=$1 for update',t) into r using target;
 if r is null then raise exception 'Unavailable content' using errcode='42501'; end if;
 if operation in ('edit','delete') and (r->>'author_id')::uuid is distinct from auth.uid() then raise exception 'Unavailable content' using errcode='42501'; end if;
 if operation='delete' and r->>'deleted_at' is not null and (r->>'revision')::bigint=expected_revision+1 then
  return jsonb_build_object('id',target,'revision',r->'revision','status','deleted','changed',false,'cleanup_pending',exists(select 1 from member_content_private.retired_media where post_id=target and removed_at is null)); end if;
 if r->>'deleted_at' is not null or (r->>'revision')::bigint<>expected_revision then raise exception 'Content changed; reload' using errcode='PT409'; end if;
 if operation='edit' then
  if r->>'status' not in ('pending','approved') or not member_content_private.alive(kind,target) then raise exception 'Not editable' using errcode='42501'; end if;
  fields:=case kind when 'post' then array['title','body','image_id','image_alt','location_label','topic','youtube_video_id','youtube_title','youtube_channel_name']
   when 'question' then array['title','body'] else array['body'] end;
  for k in select jsonb_object_keys(patch) loop
   if not k=any(fields) then raise exception 'Forbidden edit field' using errcode='42501'; end if;
   if jsonb_typeof(patch->k) not in ('string','null') then raise exception 'Invalid edit value' using errcode='23514'; end if;
  end loop;
  next_row:=r||patch; changed:=next_row is distinct from r;
  if not changed then return jsonb_build_object('id',target,'revision',r->'revision','status',r->'status','edited_at',r->'edited_at','changed',false); end if;
  if kind='post' and next_row->>'image_id' is distinct from r->>'image_id' and next_row->>'image_id' is not null then
   if not public.community_owns_uploaded_image((next_row->>'image_id')::uuid) then raise exception 'Unavailable image' using errcode='42501'; end if;
  end if;
  if kind='post' and next_row->>'youtube_video_id' is not null and
   (next_row->'youtube_video_id',next_row->'youtube_title',next_row->'youtube_channel_name') is distinct from (r->'youtube_video_id',r->'youtube_title',r->'youtube_channel_name') then
   if not exists(select 1 from member_content_private.verified_videos v where v.video_id=next_row->>'youtube_video_id' and v.title=next_row->>'youtube_title' and v.channel=next_row->>'youtube_channel_name' and v.checked_at>now()-interval '10 minutes')
   then raise exception 'Video verification required' using errcode='42501'; end if;
  end if;
  select string_agg(format('%I=v.%I',f,f),',') into assignments from unnest(fields) f;
  execute format('update public.%I p set %s from jsonb_populate_record(null::public.%I,$2) v where p.id=$1 returning to_jsonb(p)',t,assignments,t) into next_row using target,next_row;
 elsif operation='delete' then
  if patch<>'{}'::jsonb then raise exception 'Forbidden delete field' using errcode='42501'; end if;
  execute format('update public.%I p set deleted_at=clock_timestamp() where id=$1 returning to_jsonb(p)',t) into next_row using target;
 elsif operation in ('approve','reject','feature','unfeature') then
  if not public.community_is_admin() or patch<>'{}'::jsonb or r->>'status' not in ('pending','approved')
   or not member_content_private.alive(kind,target) then raise exception 'Unavailable moderation' using errcode='42501'; end if;
  if operation='approve' then
   if r->>'status'<>'pending' then raise exception 'Not pending' using errcode='PT409'; end if;
   if kind='answer' and not exists(select 1 from public.questions where id=(r->>'question_id')::uuid and status='approved' and deleted_at is null)
    or kind='review' and not exists(select 1 from public.places where id=(r->>'place_id')::uuid and status='published')
    or kind='comment' and not conversation_private.comment_context((r->>'post_id')::uuid,(r->>'parent_comment_id')::uuid)
   then raise exception 'Unavailable parent' using errcode='42501'; end if;
  end if;
  if operation in ('feature','unfeature') then
   if kind<>'post' or r->>'status'<>'approved' then raise exception 'Not featureable' using errcode='42501'; end if;
   execute 'update public.community_posts p set is_featured=$2 where id=$1 returning to_jsonb(p)' into next_row using target,operation='feature';
  else
   execute format('update public.%I p set status=$2 where id=$1 returning to_jsonb(p)',t) into next_row using target,case operation when 'approve' then 'approved' else 'rejected' end;
  end if;
 else raise exception 'Invalid operation' using errcode='42501'; end if;
 if next_row is null then raise exception 'No change applied' using errcode='PT409'; end if;
 return jsonb_build_object('id',target,'revision',next_row->'revision','status',case when operation='delete' then 'deleted' else next_row->>'status' end,'edited_at',next_row->'edited_at','changed',true,'cleanup_pending',exists(select 1 from member_content_private.retired_media where post_id=target and removed_at is null));
end $$;
revoke all on function member_content_private.mutate(text,uuid,bigint,text,jsonb) from public,anon;
grant execute on function member_content_private.mutate(text,uuid,bigint,text,jsonb) to authenticated;
create function public.manage_member_content(kind text,target uuid,expected_revision bigint,operation text,patch jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select member_content_private.mutate(kind,target,expected_revision,operation,patch)$$;
revoke all on function public.manage_member_content(text,uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.manage_member_content(text,uuid,bigint,text,jsonb) to authenticated;

-- Safe own-only projection, never author IDs. Existing callers retain their old
-- signature; new management screen uses the richer version below.
create function member_content_private.owned(target uuid default null) returns setof jsonb
language plpgsql stable security definer set search_path='' as $$
declare k text; t text;
begin
 if auth.uid() is null then return; end if;
 foreach k in array array['post','question','answer','review','comment'] loop
  t:=member_content_private.relation(k);
  return query execute format('select (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(p)) where key=any($3))||jsonb_build_object(''kind'',$2) from public.%I p where author_id=auth.uid() and ($1 is null or id=$1) and deleted_at is null and member_content_private.alive($2,id) order by created_at desc,id limit 100',t)
   using target,k,array['id','type','title','body','status','created_at','published_at','edited_at','revision','is_featured','image_id','image_alt','location_label','topic','youtube_video_id','youtube_title','youtube_channel_name','post_id','parent_comment_id','question_id','place_id'];
 end loop;
end $$;
revoke all on function member_content_private.owned(uuid) from public,anon;
grant execute on function member_content_private.owned(uuid) to authenticated;
create function public.my_manageable_content(target uuid default null) returns setof jsonb language sql stable security invoker set search_path='' as $$select * from member_content_private.owned(target)$$;
revoke all on function public.my_manageable_content(uuid) from public,anon;
grant execute on function public.my_manageable_content(uuid) to authenticated;
create or replace function public.my_community_contributions() returns table(id uuid,kind text,title text,body text,status text,created_at timestamptz,is_featured boolean,target_id uuid)
language sql stable security definer set search_path='' as $$
 select (r->>'id')::uuid,coalesce(r->>'type',r->>'kind'),r->>'title',r->>'body',r->>'status',(r->>'created_at')::timestamptz,
 coalesce((r->>'is_featured')::boolean,false),coalesce(r->>'question_id',r->>'place_id',r->>'post_id',r->>'id')::uuid
 from member_content_private.owned() r order by (r->>'created_at')::timestamptz desc limit 100
$$;
create or replace function conversation_private.own_comments(target uuid) returns table(id uuid,parent_comment_id uuid,body text,status text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select c.id,c.parent_comment_id,c.body,c.status,c.created_at from public.community_comments c
 where c.post_id=target and c.author_id=auth.uid() and c.deleted_at is null and member_content_private.alive('comment',c.id)
 and conversation_private.comment_context(c.post_id,c.parent_comment_id) order by c.created_at desc,c.id limit 50
$$;
-- Fixed-purpose server cleanup; only service_role can read object identifiers
-- after content deletion. Browser owner/admin never receive cleanup image paths.
create function public.member_media_cleanup(target uuid,completed uuid default null) returns table(image_id uuid)
language plpgsql security definer set search_path='' as $$
begin
 if completed is not null then
  update member_content_private.retired_media set removed_at=coalesce(removed_at,clock_timestamp()) where post_id=target and retired_media.image_id=completed;
  if not found then raise exception 'Missing cleanup receipt' using errcode='42501'; end if;
 end if;
 return query select r.image_id from member_content_private.retired_media r where r.post_id=target and r.removed_at is null order by r.requested_at limit 50;
end $$;
revoke all on function public.member_media_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.member_media_cleanup(uuid,uuid) to service_role;
create function public.member_cleanup_pending() returns table(post_id uuid,requested_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.post_id,min(r.requested_at) from member_content_private.retired_media r where r.removed_at is null and public.community_is_admin()
 group by r.post_id order by min(r.requested_at) limit 100
$$;
revoke all on function public.member_cleanup_pending() from public,anon;
grant execute on function public.member_cleanup_pending() to authenticated;
commit;
