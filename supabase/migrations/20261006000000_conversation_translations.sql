-- Sprint 10: private-to-API translation cache; operator review/apply only.
-- Forward-only. No existing source data, grants, policies or functions changed.
begin;

create table public.conversation_translations (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('post','comment')),
  content_id uuid not null,
  source_language text not null check (source_language in ('ko','en')),
  target_language text not null check (target_language in ('ko','en')),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  translated_text text check (char_length(translated_text) between 1 and 30000 and translated_text ~ '[^[:space:]]'),
  provider text not null check (char_length(provider) between 1 and 80),
  model text not null check (char_length(model) between 1 and 100),
  lease_token uuid not null default gen_random_uuid(),
  lease_until timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_language <> target_language),
  unique (content_type, content_id, source_language, target_language, source_hash)
);
-- Generic source IDs intentionally have no polymorphic FK. Orphan/stale cache
-- rows are inert: the server re-reads source + ancestors before every delivery.
-- The unique index also covers lookup by source; no redundant lookup index.

create table public.conversation_translation_attempts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index conversation_translation_attempts_actor_time
  on public.conversation_translation_attempts(actor_id, created_at desc);
create index conversation_translation_attempts_time
  on public.conversation_translation_attempts(created_at desc);

alter table public.conversation_translations enable row level security;
alter table public.conversation_translation_attempts enable row level security;
-- NO browser policies, not even for admins. Normal SSR/member clients cannot
-- read counts, source IDs, translations or write/poison the cache via Data API.
revoke all on public.conversation_translations from public, anon, authenticated;
revoke all on public.conversation_translation_attempts from public, anon, authenticated;
revoke all on public.conversation_translations from service_role;
revoke all on public.conversation_translation_attempts from service_role;
grant select, insert, update on public.conversation_translations to service_role;
grant select, insert on public.conversation_translation_attempts to service_role;

-- SECURITY INVOKER, not DEFINER. Only the server's secret-key client can invoke
-- this. Its actor is supplied AFTER getUser(), never from browser request input.
-- One short transaction lock serializes quota admission and lease acquisition
-- across serverless instances. No lock is held during the provider request.
create function public.claim_conversation_translation(
  p_type text, p_id uuid, p_source text, p_target text, p_hash text,
  p_actor uuid, p_provider text, p_model text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cached public.conversation_translations%rowtype;
  stamp timestamptz := clock_timestamp();
  token uuid := gen_random_uuid();
begin
  if p_actor is null then raise exception 'translation_actor_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1062026, 10);
  select * into cached from public.conversation_translations
    where content_type=p_type and content_id=p_id and source_language=p_source
      and target_language=p_target and source_hash=p_hash for update;
  if found then
    if cached.translated_text is not null then
      return jsonb_build_object('state','hit','text',cached.translated_text);
    end if;
    if cached.lease_until > stamp then return jsonb_build_object('state','busy'); end if;
  end if;
  -- Rolling windows. Cache hits/busy reservations consume no provider allowance.
  -- Failed provider attempts DO count, preventing costly retry storms.
  if (select count(*) from public.conversation_translation_attempts
        where actor_id=p_actor and created_at > stamp - interval '1 minute') >= 5
     or (select count(*) from public.conversation_translation_attempts
        where actor_id=p_actor and created_at > stamp - interval '24 hours') >= 20
     or (select count(*) from public.conversation_translation_attempts
        where created_at > stamp - interval '24 hours') >= 500 then
    return jsonb_build_object('state','limited');
  end if;
  insert into public.conversation_translation_attempts(actor_id,created_at) values(p_actor,stamp);
  insert into public.conversation_translations as existing
    (content_type,content_id,source_language,target_language,source_hash,provider,model,lease_token,lease_until,created_at,updated_at)
    values(p_type,p_id,p_source,p_target,p_hash,p_provider,p_model,token,stamp+interval '60 seconds',stamp,stamp)
    on conflict(content_type,content_id,source_language,target_language,source_hash)
    do update set lease_token=excluded.lease_token,lease_until=excluded.lease_until,
      provider=excluded.provider,model=excluded.model,updated_at=stamp
    returning * into cached;
  return jsonb_build_object('state','claimed','id',cached.id,'lease',token);
end;
$$;

create function public.finish_conversation_translation(p_id uuid, p_lease uuid, p_text text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Lease fencing: an expired/replaced worker must not overwrite newer output.
  -- NULL releases a failed request without storing raw provider errors.
  update public.conversation_translations set translated_text=p_text,
    updated_at=clock_timestamp(),lease_until=clock_timestamp()
    where id=p_id and lease_token=p_lease and lease_until>clock_timestamp()
      and translated_text is null;
  return found;
end;
$$;

revoke all on function public.claim_conversation_translation(text,uuid,text,text,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.finish_conversation_translation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_conversation_translation(text,uuid,text,text,text,uuid,text,text) to service_role;
grant execute on function public.finish_conversation_translation(uuid,uuid,text) to service_role;

-- Fail closed if project defaults accidentally grant browser table access.
do $$
begin
  if has_table_privilege('anon','public.conversation_translations','SELECT')
     or has_table_privilege('authenticated','public.conversation_translations','SELECT')
     or has_table_privilege('authenticated','public.conversation_translations','INSERT')
     or has_table_privilege('authenticated','public.conversation_translation_attempts','SELECT')
     or has_function_privilege('authenticated','public.claim_conversation_translation(text,uuid,text,text,text,uuid,text,text)','EXECUTE') then
    raise exception 'translation_privilege_check_failed';
  end if;
end;
$$;

commit;
