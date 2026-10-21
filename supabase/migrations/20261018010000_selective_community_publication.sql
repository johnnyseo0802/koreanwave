-- LOCAL DRAFT. Requires member_content_management; apply both atomically.
-- Does not change the status of any existing content.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ declare t text; begin
 foreach t in array array['community_posts','community_comments','questions','answers','reviews'] loop
  execute format('alter table public.%I add column commercial_disclosure text not null default ''unspecified'' check(commercial_disclosure in (''unspecified'',''personal'',''commercial'')), add column review_reason text not null default ''legacy_hold'', add column policy_version smallint not null default 0',t);
  execute format('grant insert(commercial_disclosure),select(commercial_disclosure,review_reason,policy_version) on public.%I to authenticated',t);
 end loop;
end $$;
create table member_content_private.restrictions(
 member_id uuid primary key references auth.users(id) on delete cascade,
 case_id uuid not null unique default gen_random_uuid(),version bigint not null default 1,
 mode text not null check(mode in ('warning','restricted','suspended','clear')),
 expires_at timestamptz, changed_at timestamptz not null default now()
);
create table member_content_private.decisions(
 id uuid primary key default gen_random_uuid(), kind text not null,target uuid not null,
 actor uuid references auth.users(id) on delete set null,action text not null,reason text not null,
 created_at timestamptz not null default now(),repeat_violation boolean not null default false
);
create table member_content_private.reports(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('post','question','answer','review','comment')),
 target uuid not null,reporter uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('commercial','spam','abuse','privacy','illegal','other')),
 state text not null default 'open' check(state in ('open','reviewed')),created_at timestamptz not null default now(),
 unique(kind,target,reporter)
);
alter table member_content_private.restrictions enable row level security;
alter table member_content_private.decisions enable row level security;
alter table member_content_private.reports enable row level security;
revoke all on member_content_private.restrictions,member_content_private.decisions,member_content_private.reports from public,anon,authenticated;
create function member_content_private.check_writer(actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,9));
 if exists(select 1 from member_content_private.restrictions where member_id=actor and
 (mode='suspended' or (mode='restricted' and expires_at>now()))) then
 raise exception 'Writing restricted; contact support for review' using errcode='42501';end if;
end $$;
revoke all on function member_content_private.check_writer(uuid) from public,anon,authenticated;

-- Same DB classifier for server Actions AND direct Data API. Not an AI/legal verdict.
create function member_content_private.classify(p jsonb,actor uuid,exclude_id uuid default null) returns text
language plpgsql security definer set search_path='' as $$
declare s text:=lower(normalize(concat_ws(' ',p->>'title',p->>'body',p->>'image_alt',p->>'location_label'),NFKC));
 t text;n integer;repeats integer:=0;
begin
 s:=regexp_replace(s,'[​‌‍﻿]','','g');
 if s ~ '(buy stolen passwords|sell stolen credit cards|미성년자 성착취물 판매|盗んだクレジットカードを販売)' then return 'prohibited';end if;
 if p->>'commercial_disclosure'='commercial' then return 'declared_commercial';end if;
 if s ~ '(use (my|our|this) (referral|promo|discount) code|[?&](ref|referral|affiliate|aff_id)=|sponsored post|paid partnership|제 추천인 코드|추천인 코드[:：]|협찬 게시|유료 광고|紹介コード[:：]|アフィリエイト|有料広告)'
 or (s ~ '(paid (tour|class|service|event)|유료 (투어|클래스|강좌)|有料(ツアー|講座))' and s ~ '(book now|reserve now|sign up|join us|모집|신청|예약|募集中|予約)')
 or s ~ '(pay (me|us|now) (via|at)|send (me|us) (payment|a deposit)|입금 후 신청|결제 후 예약|お支払いはこちら)' then return 'commercial_signal';end if;
 -- Repeat-link solicitation only. Plain links/product names/prices are not enough.
 if s ~ 'https?://' and s ~ '(buy|book|join|order|구매|모집|予約|購入)' then
  foreach t in array array['community_posts','community_comments','questions','answers','reviews'] loop
   execute format('select count(*) from public.%I where author_id=$1 and id is distinct from $2 and created_at>now()-interval ''24 hours'' and lower(btrim(body))=lower(btrim($3))',t)
    into n using actor,exclude_id,p->>'body';
   repeats:=repeats+n;
  end loop;
  if repeats>=2 then return 'repeat_promotion';end if;
 end if;
 if p->>'commercial_disclosure' is distinct from 'personal' then return 'unspecified';end if;
 return 'personal';
end $$;
revoke all on function member_content_private.classify(jsonb,uuid,uuid) from public,anon,authenticated;
create function member_content_private.insert_policy() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform member_content_private.check_writer(new.author_id);
 new.review_reason:=member_content_private.classify(to_jsonb(new),new.author_id,new.id);
 if new.review_reason='prohibited' then raise exception 'Prohibited content' using errcode='23514';end if;
 if tg_table_name='community_posts' then
  if new.type='discussion' then new.review_reason:='operator_review';end if;
 end if;
 new.status:=case when new.review_reason='personal' then 'approved' else 'pending' end;
 new.created_at:=statement_timestamp();new.updated_at:=new.created_at;
 new.published_at:=case when new.status='approved' then new.created_at else null end;
 new.edited_at:=null;new.deleted_at:=null;new.revision:=1;new.policy_version:=1;
 return new;
end $$;
revoke all on function member_content_private.insert_policy() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['community_posts','community_comments','questions','answers','reviews'] loop
 execute format('create trigger zz_member_publication before insert on public.%I for each row execute function member_content_private.insert_policy()',t);
end loop;end $$;
drop policy questions_authenticated_insert_own_pending on public.questions;
create policy questions_member_submit on public.questions for insert to authenticated with check(author_id=auth.uid() and status in ('pending','approved'));
drop policy answers_member_insert_own_pending_on_approved_question on public.answers;
create policy answers_member_submit on public.answers for insert to authenticated with check(author_id=auth.uid() and status in ('pending','approved') and exists(select 1 from public.questions q where q.id=question_id and q.status='approved'));
drop policy reviews_member_insert_own_pending_on_published_place on public.reviews;
create policy reviews_member_submit on public.reviews for insert to authenticated with check(author_id=auth.uid() and status in ('pending','approved') and exists(select 1 from public.places p where p.id=place_id and p.status='published'));
drop policy community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts for insert to authenticated with check(author_id=auth.uid() and status in ('pending','approved') and not is_featured and (image_id is null or public.community_owns_uploaded_image(image_id)));
drop policy comments_submit on public.community_comments;
create policy comments_submit on public.community_comments for insert to authenticated with check(author_id=auth.uid() and status in ('pending','approved') and conversation_private.comment_context(post_id,parent_comment_id));

create or replace function member_content_private.transition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a jsonb:=to_jsonb(old); b jsonb:=to_jsonb(new); changed boolean;
 fields text[]:=array['title','body','image_id','image_alt','location_label','topic','youtube_video_id','youtube_title','youtube_channel_name','commercial_disclosure'];
begin
 if old.deleted_at is not null then raise exception 'Unavailable content' using errcode='42501'; end if;
 if (a-fields-array['status','is_featured','published_at','updated_at','edited_at','deleted_at','revision','review_reason','policy_version'])
  is distinct from (b-fields-array['status','is_featured','published_at','updated_at','edited_at','deleted_at','revision','review_reason','policy_version'])
 then raise exception 'Immutable content identity' using errcode='42501'; end if;
 changed:=(select jsonb_object_agg(key,value) from jsonb_each(a) where key=any(fields))
  is distinct from (select jsonb_object_agg(key,value) from jsonb_each(b) where key=any(fields));
 new.edited_at:=old.edited_at; new.published_at:=old.published_at; new.review_reason:=old.review_reason; new.policy_version:=old.policy_version;
 if new.deleted_at is not null then
  if old.author_id is distinct from auth.uid() or changed then raise exception 'Owner required' using errcode='42501'; end if;
  new.deleted_at:=clock_timestamp(); new.status:='rejected';
 elsif changed then
  if old.author_id is distinct from auth.uid() or old.status not in ('pending','approved') then raise exception 'Not editable' using errcode='42501'; end if;
  perform member_content_private.check_writer(old.author_id);
  new.edited_at:=clock_timestamp();
  new.review_reason:=member_content_private.classify(to_jsonb(new),old.author_id,old.id);
  if new.review_reason='prohibited' then raise exception 'Prohibited content' using errcode='23514'; end if;
  if old.review_reason in ('declared_commercial','commercial_signal','repeat_promotion') then new.review_reason:=old.review_reason; end if;
  if old.status='pending' and new.review_reason='personal' then new.review_reason:='existing_hold'; end if;
  if tg_table_name='community_posts' then
   if new.type='discussion' then new.review_reason:='operator_review';end if;
  end if;
  new.policy_version:=1;
  new.status:=case when new.review_reason='personal' then 'approved' else 'pending' end;
  if new.status='approved' then new.published_at:=coalesce(old.published_at,statement_timestamp()); end if;
 else
  if not public.community_is_admin() or old.status not in ('pending','approved','rejected') or new.status not in ('pending','approved','rejected') then
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

create or replace function member_content_private.mutate(kind text,target uuid,expected_revision bigint,operation text,patch jsonb default '{}') returns jsonb
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
  perform member_content_private.check_writer(auth.uid());
  if r->>'status' not in ('pending','approved') or not member_content_private.alive(kind,target) then raise exception 'Not editable' using errcode='42501'; end if;
  fields:=case kind when 'post' then array['title','body','image_id','image_alt','location_label','topic','youtube_video_id','youtube_title','youtube_channel_name','commercial_disclosure']
   when 'question' then array['title','body','commercial_disclosure'] else array['body','commercial_disclosure'] end;
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

create or replace function member_content_private.owned(target uuid default null) returns setof jsonb
language plpgsql stable security definer set search_path='' as $$
declare k text; t text;
begin
 if auth.uid() is null then return; end if;
 foreach k in array array['post','question','answer','review','comment'] loop
  t:=member_content_private.relation(k);
  return query execute format('select (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(p)) where key=any($3))||jsonb_build_object(''kind'',$2) from public.%I p where author_id=auth.uid() and ($1 is null or id=$1) and deleted_at is null and member_content_private.alive($2,id) order by created_at desc,id limit 100',t)
   using target,k,array['commercial_disclosure','review_reason','policy_version','id','type','title','body','status','created_at','published_at','edited_at','revision','is_featured','image_id','image_alt','location_label','topic','youtube_video_id','youtube_title','youtube_channel_name','post_id','parent_comment_id','question_id','place_id'];
 end loop;
end $$;

create function member_content_private.audit_moderation() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if public.community_is_admin() and new.edited_at is not distinct from old.edited_at and new.deleted_at is null
 and (new.status is distinct from old.status or to_jsonb(new)->'is_featured' is distinct from to_jsonb(old)->'is_featured') then
 k:=case tg_table_name when 'community_posts' then 'post' when 'community_comments' then 'comment' when 'questions' then 'question' when 'answers' then 'answer' else 'review' end;
 insert into member_content_private.decisions(kind,target,actor,action,reason) values(k,new.id,auth.uid(),case when old.status='rejected' then 'restore' when new.status='rejected' then 'hide' when old.status='pending' then 'approve' else 'feature' end,'moderation');
 end if;return new;
end $$;
revoke all on function member_content_private.audit_moderation() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['community_posts','community_comments','questions','answers','reviews'] loop
 execute format('create trigger member_decision after update on public.%I for each row execute function member_content_private.audit_moderation()',t);
end loop;end $$;

create function public.report_member_content(kind text,target uuid,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t text:=member_content_private.relation(kind);r jsonb;
begin
 if auth.uid() is null or t is null or reason is null or reason not in ('commercial','spam','abuse','privacy','illegal','other') then raise exception 'Invalid report' using errcode='42501';end if;
 execute format('select to_jsonb(p) from public.%I p where id=$1',t) into r using target;
 if r is null or r->>'status'<>'approved' or not member_content_private.alive(kind,target) then raise exception 'Unavailable' using errcode='42501';end if;
 if kind='comment' and not conversation_private.comment_context((r->>'post_id')::uuid,(r->>'parent_comment_id')::uuid)
 or kind='answer' and not exists(select 1 from public.questions where id=(r->>'question_id')::uuid and status='approved')
 or kind='review' and not exists(select 1 from public.places where id=(r->>'place_id')::uuid and status='published')
 then raise exception 'Unavailable parent' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,10));
 if (select count(*) from member_content_private.reports where reporter=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Report limit' using errcode='23514';end if;
 insert into member_content_private.reports(kind,target,reporter,reason) values(kind,target,auth.uid(),reason) on conflict on constraint reports_kind_target_reporter_key do nothing;
end $$;
revoke all on function public.report_member_content(text,uuid,text) from public,anon;
grant execute on function public.report_member_content(text,uuid,text) to authenticated;

create function public.review_member_policy(kind text,target uuid,expected_revision bigint,action text,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t text:=member_content_private.relation(kind);r jsonb;subject uuid;repeat_offence boolean;
begin
 if not public.community_is_admin() or t is null or reason is null or reason not in ('commercial','spam','abuse','privacy','illegal','other','false_positive')
 or action is null or action not in ('approve','hide','keep','restore','warn','restrict','suspend') then raise exception 'Forbidden' using errcode='42501';end if;
 execute format('select to_jsonb(p) from public.%I p where id=$1 for update',t) into r using target;
 if r is null or r->>'deleted_at' is not null or not member_content_private.alive(kind,target) then raise exception 'Unavailable' using errcode='42501';end if;
 if expected_revision is null or (r->>'revision')::bigint<>expected_revision then raise exception 'Reload content' using errcode='PT409';end if;
 subject:=(r->>'author_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(subject::text,9));
 repeat_offence:=exists(select 1 from member_content_private.restrictions where member_id=subject and mode<>'clear');
 if action in ('approve','hide') then
  perform member_content_private.mutate(kind,target,expected_revision,case action when 'approve' then 'approve' else 'reject' end,'{}');
 elsif action='restore' then
  if r->>'status'<>'rejected' then raise exception 'Not hidden' using errcode='PT409';end if;
  if kind='comment' and not conversation_private.comment_context((r->>'post_id')::uuid,(r->>'parent_comment_id')::uuid)
  or kind='answer' and not exists(select 1 from public.questions where id=(r->>'question_id')::uuid and status='approved')
  or kind='review' and not exists(select 1 from public.places where id=(r->>'place_id')::uuid and status='published') then raise exception 'Unavailable parent' using errcode='42501';end if;
  execute format('update public.%I set status=''approved'' where id=$1',t) using target;
 elsif action in ('warn','restrict','suspend') then
  if subject=auth.uid() or exists(select 1 from public.profiles where id=subject and role='admin') then raise exception 'Admin account requires separate process' using errcode='42501';end if;
  -- Do not silently downgrade an active sanction via a warning/restriction.
  -- Clearing a sanction is a separate explicit, audited administrator action.
  if action in ('warn','restrict') and exists(select 1 from member_content_private.restrictions where member_id=subject and
   (mode='suspended' or (action='warn' and mode='restricted' and expires_at>now()))) then raise exception 'Review active restriction first' using errcode='PT409';end if;
  insert into member_content_private.restrictions(member_id,mode,expires_at) values(subject,case action when 'warn' then 'warning' when 'restrict' then 'restricted' when 'suspend' then 'suspended' else 'clear' end,case when action='restrict' then now()+interval '7 days' end)
  on conflict(member_id) do update set mode=excluded.mode,expires_at=excluded.expires_at,changed_at=clock_timestamp(),version=restrictions.version+1;
 end if;
 -- Every reviewed decision consumes the supplied content revision. Direct
 -- UPDATE remains denied by restrictive RLS from the prerequisite migration.
 if action in ('keep','warn','restrict','suspend') then
  execute format('update public.%I set revision=revision+1 where id=$1',t) using target;
 end if;
 update member_content_private.reports set state='reviewed' where reports.kind=review_member_policy.kind and reports.target=review_member_policy.target;
 insert into member_content_private.decisions(kind,target,actor,action,reason,repeat_violation) values(kind,target,auth.uid(),action,reason,repeat_offence);
end $$;
revoke all on function public.review_member_policy(text,uuid,bigint,text,text) from public,anon;
grant execute on function public.review_member_policy(text,uuid,bigint,text,text) to authenticated;

create function public.my_writing_restriction() returns table(mode text,expires_at timestamptz,case_id uuid)
language sql stable security definer set search_path='' as $$select mode,expires_at,case_id from member_content_private.restrictions where member_id=auth.uid() and (mode in ('warning','suspended') or (mode='restricted' and expires_at>now()))$$;
revoke all on function public.my_writing_restriction() from public,anon;
grant execute on function public.my_writing_restriction() to authenticated;

-- A mistaken sanction must remain reversible after the source is deleted.
-- This endpoint returns no source, image, member identity or original content.
create function public.clear_member_writing_restriction(case_id uuid,expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare subject uuid;r member_content_private.restrictions;
begin
 if not public.community_is_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 select member_id into subject from member_content_private.restrictions where restrictions.case_id=clear_member_writing_restriction.case_id;
 if subject is null then raise exception 'Unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(subject::text,9));
 select * into r from member_content_private.restrictions where member_id=subject for update;
 if expected_version is null or r.version<>expected_version or r.mode='clear' then raise exception 'Reload restriction' using errcode='PT409';end if;
 update member_content_private.restrictions set mode='clear',expires_at=null,version=version+1,changed_at=clock_timestamp() where member_id=subject;
 insert into member_content_private.decisions(kind,target,actor,action,reason) values('restriction',r.case_id,auth.uid(),'clear','manual_reconsideration');
end $$;
revoke all on function public.clear_member_writing_restriction(uuid,bigint) from public,anon;
grant execute on function public.clear_member_writing_restriction(uuid,bigint) to authenticated;

create function public.member_policy_queue(view_name text default 'pending') returns setof jsonb
language plpgsql stable security definer set search_path='' as $$
declare k text;t text;
begin
 if not public.community_is_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 if view_name='restrictions' then
 return query select jsonb_build_object('id',r.case_id,'kind','restriction','revision',r.version,'status',r.mode,'expires_at',r.expires_at)
 from member_content_private.restrictions r where r.mode in ('warning','suspended') or (r.mode='restricted' and r.expires_at>now()) order by r.changed_at desc limit 100;return;
 end if;
 if view_name='history' then
 return query select jsonb_build_object('id',d.id,'kind',d.kind,'target',d.target,'action',d.action,'reason',d.reason,'created_at',d.created_at,'repeat_violation',d.repeat_violation)
 from member_content_private.decisions d order by d.created_at desc limit 100;return;
 end if;
 if view_name not in ('pending','reports','hidden') then raise exception 'Invalid view' using errcode='23514';end if;
 foreach k in array array['post','question','answer','review','comment'] loop
 t:=member_content_private.relation(k);
 return query execute format('select jsonb_build_object(''kind'',$1,''id'',p.id,''title'',to_jsonb(p)->>''title'',''body'',p.body,''status'',p.status,''revision'',p.revision,''review_reason'',p.review_reason,''commercial_disclosure'',p.commercial_disclosure,
 ''reports'',(select count(*) from member_content_private.reports r where r.kind=$1 and r.target=p.id and r.state=''open''))
 from public.%I p where p.deleted_at is null and member_content_private.alive($1,p.id) and
 (($2=''pending'' and p.status=''pending'') or ($2=''hidden'' and p.status=''rejected'') or ($2=''reports'' and exists(select 1 from member_content_private.reports r where r.kind=$1 and r.target=p.id and r.state=''open'')))
 order by p.created_at,p.id limit 50',t) using k,view_name;
 end loop;
end $$;
revoke all on function public.member_policy_queue(text) from public,anon;
grant execute on function public.member_policy_queue(text) to authenticated;
commit;
