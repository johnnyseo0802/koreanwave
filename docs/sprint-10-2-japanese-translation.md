# Sprint 10.2 — English / Korean / Japanese conversation translation

Release status: the operator reports the Production migration was manually applied
and both language CHECK constraints allow ko/en/ja with convalidated=true.
Do not reapply it. Application release is authorized; Production E2E remains manual.
No live OpenAI calls, real keys inspected or production content writes.

## Audit and scope

Sprint 10 already keys cache/leases by content type + ID + exact server SHA-256 +
source language + target language. The provider accepts language codes and faithful
translation instructions, preserving tone/slang/humor/disagreement/emojis. Reuse it
unchanged (including configured model, cultural/conversational meaning instructions,
timeouts, safe failure diagnostics and server-only credentials). No new provider,
key, automatic translation or prompt/model change. Live Japanese translation quality
and cultural nuance still require operator testing; fixture tests prove plumbing,
not model quality.

Only approved Discussion/Moment/Story/Tip bodies and eligible comments/replies use
this component. Titles, articles, Questions/Answers, Reviews and profiles remain
unchanged. Normal SSR auth verifies the member; public originals remain readable
without login. Approved post/root checks run before cache lookup and before delivery.

## Language detection

- EN → KO / JA, KO → EN / JA, JA → EN / KO; all six directed pairs supported.
- Same-language requests remain no-op. Unsupported languages rejected server-side.
- Detection-only NFKC supports halfwidth kana. Exact original is NOT normalized
  for rendering, provider text or source hash; source edits still invalidate cache.
- Japanese requires at least 2 kana letters, at least 4 kana+Han letters, and
  >=65% kana/Han share of all letters. Supports kanji with hiragana/katakana.
- Kanji-only text (e.g. 韓国旅行) is ambiguous with Chinese and remains unknown.
  Very short responses such as はい also remain unknown. No forced language claim.
- Dominant Korean continues using >=4 Hangul and >=65% letters. Balanced KO/JA/EN
  mixtures abstain; dominant Japanese may include English loanwords. English retains
  existing common-word evidence. Detection is intentionally heuristic, not perfect.
- Unknown content keeps original + explanatory notice, no provider request.

## UI and cache

Labeled native select lists only the other two supported languages. Defaults retain
existing behavior (EN→KO, KO→EN; JA→EN). Selecting does not call the provider; explicit
Translate is required. Selection resets the view to original so an old translation
cannot be mislabeled as a different target. Loading disables selector and button.
Per-target in-memory cache reuses translations when switching back. Source changes
remount that state. Show original, escaped text, lang attributes, aria-live/busy,
44px targets, keyboard access and wrapping remain. Root translation never translates
replies automatically. Failed requests never remove the original.

## Migration (operator-applied in Production)

`supabase/migrations/20261008000000_conversation_translation_japanese.sql`

Only replaces two existing CHECK definitions on conversation_translations to add
`ja`. No row rewrites, functions, privileges, RLS or quota changes. Source != target
and unique cache identity remain. Existing EN/KO rows satisfy the wider constraints.
Uses one transaction: any error rolls back. Ordinary ALTER TABLE lock/check scan
applies; schedule appropriately for production size. Do not rerun applied migrations
or auto-drop tables if existing constraint names differ.

Complete SQL:

```sql
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
```

The existing claim RPC delegates language validation to table constraints; it needs
no change. Five per minute/twenty per day per member and 500/day project limits remain
shared across ALL language pairs, not reset per language. A new target is a distinct
paid cache miss; identical cached requests cost no provider quota. Browser cache/RPC
access remains denied; only the existing isolated server adapter can use them.

## Read-only operator verification

Before applying, confirm the named checks exist; after applying confirm both include
ja. Other checks and safe access should be unchanged. Do not create test rows:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.conversation_translations'::regclass
order by conname;
select relrowsecurity from pg_class
where oid='public.conversation_translations'::regclass;
select role_name,
  has_table_privilege(role_name,'public.conversation_translations','SELECT') as cache_read,
  has_table_privilege(role_name,'public.conversation_translations','INSERT') as cache_write,
  has_function_privilege(role_name,
    'public.claim_conversation_translation(text,uuid,text,text,text,uuid,text,text)',
    'EXECUTE') as claim_access
from unnest(array['anon','authenticated']) role_name;
-- Expected: RLS true; all six browser privilege booleans false.
```

## Tests and rollout

- translation-security: all six action directions, per-target hits, exact hash/source
  invalidation, Japanese kana/kanji/halfwidth/short/mixed cases, same-language no-op,
  auth/hidden ancestors, unsupported types/languages, no client text substitution.
- translation-japanese-db-security: actual old+new SQL, original rows preserved,
  all six directions through existing claim/finish RPCs, unique keys, lease/hits,
  browser access denied, unsupported/same language rejected, identical grants/RLS/
  RPC definitions and indexes before/after. All in isolated PGlite.
- translation-browser: real Next Server Action with loopback provider/Auth/cache,
  six pairs, accessible select/no same-language options/no automatic calls, repeated
  targets/cache, Show original, failures/retry, independent reply, 390x844/390x320/
  768x900/1440x900 keyboard/touch/wrapping. No real provider request.
- Existing translation diagnostics, security, conversation, community, discovery,
  clusters and mobile navigation regressions remain required.

Rollout: review SQL → operator applies new migration and verifies catalog → authorize
commit/deployment separately → operator manually checks all six directions on real
eligible conversations. Existing server env names/model unchanged; no new variables.
Deploy schema first: old code works with the wider checks; new code without migration
fails JA cache claims safely but cannot complete Japanese translation. Confirm
Production's Sprint 10 credentials and real translation issue separately; this sprint
does not prove or claim that earlier Production failure has been resolved.

Rollback app independently if necessary; keep widened constraints. Do not narrow
constraints once JA cache rows exist without a separate reviewed data/retention plan.

## Local verification result (2026-10-08)

- pnpm lint: PASS. pnpm build: PASS using the normal .next directory.
- All 19 `tests/*security.mjs` suites: PASS, including the isolated Japanese DB test.
- Translation, conversation, site, community, clusters, discovery and mobile-navigation
  browser suites: PASS. All use local fixtures; no live provider or production writes.
- Site-wide suite skipped six listing-to-detail checks because its fixture has no
  public Events, Questions, Places, Experiences, K-Contents or K-Trends items.
  Separate populated discovery tests passed 20 routes at three viewport widths.
- git diff --check: PASS. No commit, push or remote migration performed.
