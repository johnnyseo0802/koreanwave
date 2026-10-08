-- Sprint 10.2: widen only the two language constraints. Operator review/apply only.
-- Existing EN/KO rows, source <> target, cache identity, RLS, grants, RPCs,
-- reservation leases, quotas and all community moderation remain unchanged.
begin;

alter table public.conversation_translations
  drop constraint conversation_translations_source_language_check,
  add constraint conversation_translations_source_language_check
    check (source_language in ('ko','en','ja')),
  drop constraint conversation_translations_target_language_check,
  add constraint conversation_translations_target_language_check
    check (target_language in ('ko','en','ja'));

commit;
