-- Operator-only T0, committed BEFORE the atomic A+B package. No content updates.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create schema if not exists member_deployment;
revoke all on schema member_deployment from public,anon,authenticated,service_role;
create table if not exists member_deployment.gate (
 singleton boolean primary key check(singleton), activation uuid not null default gen_random_uuid(),
 candidate_sha text check(candidate_sha ~ '^[0-9a-f]{40}$'),
 verified_sha text, verified_deployment text, verified_at timestamptz
);
-- A normal Storage trigger uses the granted TRIGGER privilege. Do not ALTER
-- managed table ownership/trigger mode. The permanent guard is dormant on release.
alter table member_deployment.gate add column if not exists storage_frozen boolean not null default true;
revoke all on member_deployment.gate from public,anon,authenticated,service_role;
create or replace function member_deployment.targets(final_schema boolean) returns text[]
language sql immutable set search_path='' as $$
 select array['public.community_posts','public.community_comments','public.questions','public.answers','public.reviews',
 'public.community_helpful','public.community_reports','public.community_uploads','public.article_discussions',
 'public.community_prompt','public.content_clusters','public.content_cluster_items','public.content_cluster_prompts',
 'public.conversation_translations','public.conversation_translation_attempts']
 || case when final_schema then array['member_content_private.retired_media','member_content_private.verified_videos',
 'member_content_private.restrictions','member_content_private.decisions','member_content_private.reports'] else array[]::text[] end
$$;
create or replace function member_deployment.reject_write() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'Community maintenance; retry later' using errcode='55000'; end $$;
create or replace function member_deployment.reject_storage_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare frozen boolean;
begin
 -- Only the operator-owned gate is read with elevated privilege; no content DML.
 -- Missing state fails closed. App roles cannot alter this flag or the function.
 -- A pre-existing REPEATABLE READ snapshot must not observe a stale released
 -- flag: a changed row produces a real serialization failure rather than bypass.
 select storage_frozen into frozen from member_deployment.gate where singleton for share;
 if coalesce(frozen,true) then
  if tg_op='TRUNCATE' then raise exception 'Community maintenance; retry later' using errcode='55000';end if;
 else
  if tg_op='DELETE' then return old;elsif tg_op='TRUNCATE' then return null;else return new;end if;
 end if;
 if tg_op='INSERT' then
  if new.bucket_id='community-media' then raise exception 'Community maintenance; retry later' using errcode='55000';end if;
  return new;
 elsif tg_op='DELETE' then
  if old.bucket_id='community-media' then raise exception 'Community maintenance; retry later' using errcode='55000';end if;
  return old;
 else
  if old.bucket_id='community-media' or new.bucket_id='community-media' then raise exception 'Community maintenance; retry later' using errcode='55000';end if;
  return new;
 end if;
end $$;
create or replace function member_deployment.install_guards(final_schema boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare target text;
begin
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','authenticator')
  and (rolsuper or has_parameter_privilege(oid,'session_replication_role','SET')))
 then raise exception 'API role can bypass normal triggers';end if;
 foreach target in array member_deployment.targets(final_schema) loop
  if to_regclass(target) is null then raise exception 'Freeze baseline incomplete';end if;
  execute format('lock table %s in share row exclusive mode',target);
  if not exists(select 1 from pg_trigger where tgrelid=target::regclass and tgname='a_member_deployment_freeze') then
   execute format('create trigger a_member_deployment_freeze before insert or update or delete or truncate on %s for each statement execute function member_deployment.reject_write()',target);
  end if;
  execute format('alter table %s enable always trigger a_member_deployment_freeze',target);
 end loop;
 lock table storage.objects in share row exclusive mode;
 if not exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='a_member_storage_freeze') then
  create trigger a_member_storage_freeze before insert or update or delete on storage.objects for each row execute function member_deployment.reject_storage_write();
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='a_member_storage_truncate_freeze') then
  create trigger a_member_storage_truncate_freeze before truncate on storage.objects for each statement execute function member_deployment.reject_storage_write();
 end if;
end $$;
create or replace function member_deployment.assert_guards(final_schema boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare target text;
begin
 foreach target in array member_deployment.targets(final_schema) loop
  if not exists(select 1 from pg_trigger where tgrelid=to_regclass(target) and tgname='a_member_deployment_freeze'
   and tgenabled='A' and tgfoid='member_deployment.reject_write()'::regprocedure and tgtype=62)
  then raise exception 'Freeze guard missing or changed';end if;
 end loop;
 if not exists(select 1 from member_deployment.gate where singleton and storage_frozen)
 or not exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='a_member_storage_freeze'
  and tgenabled='O' and tgfoid='member_deployment.reject_storage_write()'::regprocedure and tgtype=31)
 or not exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='a_member_storage_truncate_freeze'
  and tgenabled='O' and tgfoid='member_deployment.reject_storage_write()'::regprocedure and tgtype=34)
 then raise exception 'Storage freeze guard missing or changed';end if;
end $$;
revoke all on all functions in schema member_deployment from public,anon,authenticated,service_role;
-- Reactivation after failed deployment must include the new private tables.
select member_deployment.install_guards(to_regnamespace('member_content_private') is not null);
-- Lock targets before changing the gate row, so an in-flight Storage write
-- holding a gate share lock can finish before activation acquires that row.
insert into member_deployment.gate(singleton) values(true)
on conflict(singleton) do update set storage_frozen=true,activation=gen_random_uuid(),candidate_sha=null,
 verified_sha=null,verified_deployment=null,verified_at=null;
select member_deployment.assert_guards(to_regnamespace('member_content_private') is not null);
commit;
