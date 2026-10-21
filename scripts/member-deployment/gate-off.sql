-- release-gate.mjs attests and executes this in ONE transaction; not a standalone unlock.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ declare target text; begin
 perform 1 from member_deployment.gate where singleton for update;
 if not exists(select 1 from member_deployment.gate where singleton and candidate_sha=verified_sha
  and candidate_sha is not null and verified_deployment is not null
  and verified_at between clock_timestamp()-interval '2 minutes' and clock_timestamp())
 then raise exception 'Verified new application required' using errcode='55000';end if;
 perform member_deployment.assert_guards(true);
 if to_regprocedure('public.manage_member_content(text,uuid,bigint,text,jsonb)') is null
  or to_regprocedure('public.review_member_policy(text,uuid,bigint,text,text)') is null
  or to_regprocedure('public.clear_member_writing_restriction(uuid,bigint)') is null
  or (select count(*) from pg_policies where schemaname='public' and policyname='member_no_direct_update'
   and permissive='RESTRICTIVE' and qual='false' and with_check='false')<>5
  or not exists(select 1 from pg_policies where schemaname='storage' and policyname='member_media_download_only' and permissive='RESTRICTIVE')
 then raise exception 'Release schema incomplete';end if;
 foreach target in array member_deployment.targets(true) loop
  execute format('drop trigger a_member_deployment_freeze on %s',target);
 end loop;
 -- Removing/disabling a managed-table trigger requires ownership. Leave the
 -- normal trigger installed and deactivate its operator-only state atomically.
 update member_deployment.gate set storage_frozen=false,verified_sha=null,verified_deployment=null,verified_at=null;
end $$;
commit;
