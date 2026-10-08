# Sprint 10 — multilingual conversation layer V1

Status (2026-10-07): operator reports the reviewed
`20261006000000_conversation_translations.sql` applied to Production and verified:
both tables exist, both RLS flags enabled, anon/member cache SELECT denied, member
cache INSERT/attempts SELECT/claim EXECUTE denied. Server environment variables
are operator-confirmed configured in Vercel Production and Preview. Values were
not inspected. No independent remote SQL-definition checksum was obtained.
The production migration step is closed; do not reapply it. Release commit/push
is authorized after local regression passes. No live translation/provider request
or production content write is part of the automated verification.

## Audit before implementation

- Next 16.3.5 App Router / React 19, Supabase SSR 0.12.7. Normal server helpers
  use cookie sessions and the publishable key. Proxy refreshes verified claims
  and sets private/no-store response headers; authorization uses `getUser()`.
- Sprint 9.1 `community_posts` supports discussion/moment/story/tip; comments and
  one-level replies publish immediately. Reports do not hide content. Moderation
  can reject public content; replies require an approved root and post.
- Public DAL explicitly filters approval even for admins. Admin access rechecks
  the current user's private profile role. No public author/profile fields needed.
- Article discussions link into the existing conversation, not a separate thread.
  Homepage and Trending use public activity aggregates; reactions/Helpful and
  private reporting are independent. Questions and Reviews are separate flows.
- `profiles.preferred_language` already supports en/ko. It remains unchanged and
  does not trigger requests. No translation model/cache/provider previously existed.
- The private community-media writer already uses an isolated server secret.
  Do not reuse that credential/client for translation. Existing media, questions,
  event meeting details and private schemas/policies are not changed.
- Existing tests use VM mocks, isolated PGlite migrations and Next/Playwright
  loopback fixtures. No `.env.example` is tracked; `.env.local` stays ignored.

## Implementation and UX

`TranslatableContent` replaces only body rendering in the approved post detail
and its public comments/replies. Discussion, Moment, Story, Tip share that route.
Original text renders immediately and remains escaped in the DOM when toggled.
Each reply has its own loading/result/error state; no root-to-reply fan-out.
Titles, feed previews, editorial articles, Questions/Answers and Reviews are not
translated. Existing identity labels and all moderation behavior remain intact.

V1 requires login **to request translations**, not to read originals. Logged-out
visitors get a safe login return CTA. This is a deliberate cost-control choice,
not a new protected community route. No automatic translation or page-load cache
request. Explicit Translate chooses the opposite detected language. Show original
and subsequent toggles use the already-loaded local result without provider calls.
Content changes remount the local result state. Accessible >=44px buttons,
aria-busy/live feedback, plain text wrapping and independent nested replies.

Local detection is conservative: dominant Hangul or Latin text with multiple common
English words; balanced mixtures, other scripts, short names/ambiguous text abstain.
This heuristic can have false negatives (and is not perfect language proof).
Unknown text never reaches the provider. Same-language direct requests are no-op.

## Server request / visibility boundary

1. Server Action accepts exactly contentType (`post`/`comment`), UUID, target (`ko`/`en`).
   Extra source text/hash/identity/status fields are rejected, not trusted.
2. Normal SSR `getUser()` verifies the requesting member. No client user ID/role.
3. Normal cookie client loads authoritative body with explicit approved filters.
   A comment also requires approved post and, for a reply, approved root in the
   same post with no parent. Owners/admins receive no private translation exception.
4. Detect source, enforce 10,000-code-point input maximum, SHA-256 exact UTF-8 body.
5. Server-only cache access checks the full identity. No original body copy stored.
6. Cache miss reserves a lease and quota in one DB transaction, then calls provider.
7. Recheck exact source and ancestor visibility after provider and on cache hits.
   Store/return only valid current results. Generic failure for hidden/missing objects.

No global Next cache is used for source or action output. Existing Proxy no-store
headers remain. Provider and cache fetches also use no-store. There is a normal
read-vs-moderation race after the final read, as with original HTML already sent.
Already-delivered text cannot be recalled from a user's screen; no polling or
WebSockets are added. A later server request cannot retrieve the hidden cache.

## Provider abstraction / data handling

`translation-provider.ts` implements `TranslationProvider.translateText` and is
replaceable without UI changes. Uses OpenAI Responses API, fixed HTTPS endpoint,
20s timeout, 8,192 output-token ceiling, no tools/history, `store:false`, explicit
system-level instructions and a separate untrusted JSON source-text envelope.
This follows [official Responses guidance](https://developers.openai.com/api/docs/guides/migrate-to-responses).

Only the public body is sent, not IDs/profiles/cookies or thread context. Faithful
translation instructions preserve tone, uncertainty, disagreement, slang and emojis.
Source instructions must be translated, not obeyed. Refusals/incomplete/empty/oversize
responses are rejected. All output remains escaped text, never HTML/Markdown.
Instruction hierarchy reduces prompt injection; no LLM can guarantee semantic
faithfulness or immunity. Manually assess slang/tone/adversarial samples before
enabling production. AI labels and original toggle make original authoritative.
`store:false` does not promise zero retention under all provider data policies.
Operator must review the provider's data handling/privacy terms and disclose this
on-demand text processing before launch. No live provider test was performed.

## Cache, RLS, credentials and migration

New forward-only migration:
`supabase/migrations/20261006000000_conversation_translations.sql`.

- `conversation_translations`: generic source type/UUID, languages, exact hash,
  output, provider/model metadata, DB timestamps and short reservation lease.
  Unique `(content_type,content_id,source_language,target_language,source_hash)`.
  A changed body creates a different entry; old hashes never match current reads.
  Model changes do not invalidate existing faithful translations in V1.
- `conversation_translation_attempts`: private authenticated actor UUID/time only,
  rolling quota index by actor/time and global time; no copied source or output.
  Actor deletion cascades only their quota records. No existing rows affected.
- Both tables RLS enabled, zero anon/auth policies, all anon/auth/PUBLIC grants
  revoked. Normal members and admins cannot read even counts, or poison the cache.
- Two **SECURITY INVOKER**, empty-search-path RPCs, executable only by service_role:
  claim (atomic quota + lease), finish (fenced completion/failure release).
  No SECURITY DEFINER, no change to `conversation_private`, no new identity RPC.
- Separate server-only `SUPABASE_TRANSLATION_SECRET_KEY` using current `sb_secret_`
  key format. Supabase maps it to elevated service_role; **project-wide privilege**,
  not a database-scoped key. Application wrapper restricts its use to the new fixed
  cache tables/RPCs only. Normal SSR/browser clients never use it. No legacy JWT
  service-role key accepted. Privileged cache access cannot authorize source reads.

Cache generic IDs intentionally have no polymorphic FK. Orphan/stale translations
are inaccessible without a live approved source. In V1 they are retained; operator
should plan periodic cache/old-attempt retention cleanup separately (not implemented
or run here). Do not expose table grants to solve any application error. Supabase
default future schema grants are neutralized explicitly in this migration.

## Cost / concurrency

- Provider misses: 5/member/rolling minute, 20/member/rolling 24h,
  500/project/rolling 24h. Includes failed calls. Hits/busy leases cost no quota.
- Transaction advisory lock serializes admission across instances. Unique index
  prevents duplicate cache identity. 60s fenced lease >20s provider timeout.
- A second in-flight request gets a friendly retry message, not another call.
  Crash lease expires; old worker cannot overwrite replacement lease result.
- UI ref lock + disabled button avoids repeated clicks. No automatic retries.
- Limits are a simple cost cap, not exhaustive DDoS protection or billing. Apply
  provider project spending limits and hosting/WAF request limits operationally.

## Environment configuration (names only)

Configure in local ignored `.env.local` for manual testing and Vercel server env
only after review; never NEXT_PUBLIC, never chat, never committed values:

- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL` — operator-selected Responses-compatible text model;
  no silent default or model pricing assumption. Check availability and output limit.
- `SUPABASE_TRANSLATION_SECRET_KEY` — separate secret used only by cache adapter.

Existing `NEXT_PUBLIC_SUPABASE_URL` remains the project endpoint. Existing normal
publishable key and community-media secret are unchanged. Missing config or missing
migration disables translation gracefully; pages, originals and build still work.
Missing provider config can still serve existing cache with cache credentials.

## Diagnostics without sensitive logging

Only closed-vocabulary server diagnostics, never raw errors. Operator checks variable presence
(never copies values), migration catalog/grants, and provider's dashboard status/
quota. Inspect cache **counts/timestamps/provider metadata** in SQL Editor, not
public APIs; avoid exporting text/actor IDs. First request increments attempts;
identical cached request does not. Failure can leave a released null-text cache
entry; later manual retry is permitted within limits. No extra admin console.

### Production failure diagnostics (2026-10-08, pending deployment approval)

A Server Action returns `{ok:false,message}` normally, so Vercel's HTTP 2xx is not
evidence of OpenAI or cache success. Previously the action's two catch blocks, null
configuration returns, collapsed cache errors, provider generic throws and false
finalization all hid the failing stage. No exact Production cause is established
without an observed event. API credit purchase alone cannot diagnose a cache/RPC,
model permission, timeout or response-validation failure.

After this change is explicitly released, operator clicks Translate once and opens
that Vercel invocation's Runtime Logs (include warning level). Search for
`translation.failure`. Each JSON event includes only version, stage, reason, optional
numeric HTTP status and a strictly allowlisted error code. No IDs (including request
IDs), hashes, env/model values, source/translated text, headers, message or stack.
One failure may be followed by a separate cache_release failure; retain both safe
events. No correlation identifier is necessary: use the Vercel invocation view.

| Stage / reason | Operator check |
| --- | --- |
| configuration / openai_key_missing, model_missing, model_format_invalid | Variable configured for the deployed environment; model format has no whitespace. Validation is syntactic, not an availability check. |
| configuration / cache_secret_missing, cache_secret_invalid, supabase_client_invalid | Correct server-only credential type and Supabase server config; never paste values into logs/chat. |
| source_read / supabase_error | Normal SSR source read/API availability; no hidden object details are logged. |
| source_validation / source_unavailable, source_changed | Source/ancestor no longer eligible or changed; do not weaken visibility checks. |
| cache_read or cache_claim / supabase_error | HTTP status + safe code: 42501 permissions, 42P01/PGRST205 table missing, 42883/PGRST202 function/schema cache, 23514 constraint. Check reviewed migration/project alignment without widening grants. |
| provider_response / model_or_access | model_not_found can mean unavailable to this API project, not necessarily a globally invalid model ID. |
| provider_response / authentication, permission | Correct provider project key and project/model access. |
| provider_response / billing | insufficient_quota or billing_hard_limit_reached; verify credit/billing for the same provider project. |
| provider_response / rate_limit, provider_error, request_rejected | Provider throttling, 5xx availability or rejected request parameters. Unknown provider codes are omitted. |
| provider_request / timeout, network | Existing 20-second timeout or transport failure; no automatic timeout/model/semantic change made. |
| provider_validation / incomplete, refusal, invalid_json, invalid_output, empty_or_oversized | Provider answered but output failed existing validation; max_output_tokens/content_filter are safe incomplete codes. |
| cache_finalize / supabase_error, zero_rows_or_expired_lease | Translation reached storage; inspect RPC/grants or expired/replaced 60-second lease. |
| cache_release | Cleanup failed after another failure; inspect the earlier event first. |

OpenAI Docs confirms `gpt-6-luna` is an API model with Responses support:
https://developers.openai.com/api/docs/models/gpt-6-luna
This does not verify this deployment's actual env value, model entitlement, API
project billing or successful live access. No live provider request was made.
Logger behavior/redaction is covered by `tests/translation-diagnostics-security.mjs`.
User-facing messages, original toggle, RLS, quotas and moderation are unchanged.

## Pre-apply verification (read-only; do not execute automatically)

```sql
select to_regclass('public.conversation_translations') as new_cache_should_be_null,
       to_regclass('public.conversation_translation_attempts') as new_attempts_should_be_null,
       to_regclass('public.community_posts') as posts_must_exist,
       to_regclass('public.community_comments') as comments_must_exist;
select rolname, rolbypassrls from pg_roles where rolname='service_role';
select has_column_privilege('anon','public.community_comments','author_id','SELECT') as must_be_false,
       has_column_privilege('authenticated','public.questions','author_id','SELECT') as also_false;
```

## Post-apply verification (read-only; operator executes after SQL review)

```sql
select relname,relrowsecurity from pg_class
where oid in ('public.conversation_translations'::regclass,
              'public.conversation_translation_attempts'::regclass);
select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in
('conversation_translations','conversation_translation_attempts')
order by table_name,grantee,privilege_type;
select r, t, p, has_table_privilege(r,t,p) as browser_must_be_false
from unnest(array['anon','authenticated']) r
cross join unnest(array['public.conversation_translations','public.conversation_translation_attempts']) t
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;
select proname,prosecdef,proconfig from pg_proc
where oid in (
'public.claim_conversation_translation(text,uuid,text,text,text,uuid,text,text)'::regprocedure,
'public.finish_conversation_translation(uuid,uuid,text)'::regprocedure);
select r, f, has_function_privilege(r,f,'EXECUTE') as allowed
from unnest(array['anon','authenticated','service_role']) r
cross join unnest(array[
'public.claim_conversation_translation(text,uuid,text,text,text,uuid,text,text)',
'public.finish_conversation_translation(uuid,uuid,text)']) f;
-- Expected: only service_role true; both functions prosecdef=false.
select schemaname,tablename,policyname from pg_policies
where tablename in ('conversation_translations','conversation_translation_attempts');
-- Expected: no browser policies (empty), both RLS flags true above.
select indexname,indexdef from pg_indexes where schemaname='public'
and tablename in ('conversation_translations','conversation_translation_attempts');
```

Migration is one transaction; error aborts all new objects. Not rerunnable after
success. Do not wrap in IF NOT EXISTS or drop existing objects to bypass a conflict.
Before commit, confirm public existing grants/RLS were not changed. Application
rollback can disable translation by removing provider configuration without touching
source data; deleting cache objects would need a separately reviewed migration.

## Tests / production manual procedure

Automated scripts (no real provider/production writes):

- `tests/translation-security.mjs`: authoritative source/type/extra-field checks,
  auth, exact hash/cache miss/hit/change, unknown/mixed/no-op, failures, approved
  post/comment/root filters including broad admin visibility; provider data envelope.
- `tests/translation-db-security.mjs`: actual new SQL in PGlite, browser cache/count/
  write/RPC denial, unique identity, constraints, leases, rate limits, no definers.
- `tests/translation-browser.mjs`: real built Next action + loopback Auth/cache/
  provider fixtures at 390x844/390x320/768x900/1440x900; no automatic calls, ko/en,
  loading, disabled/double click, original retention/toggle, failure/retry, isolated
  reply, cache reload, 44px targets, keyboard, wrapping and escaped HTML.
- All prior `tests/*security.mjs`, conversation/site/community/clusters/discovery/
  mobile-navigation browser suites remain required. Live production readonly probe
  is opt-in and not part of this task.

Local results (2026-10-05): lint PASS, production build/typecheck PASS; 17 security
scripts PASS (15 existing + 2 translation); 7 browser suites PASS (6 existing +
translation). Translation screenshots inspected at 390px; no horizontal overflow.
General site-browser skipped six detail-link checks because its fixture has no
Events/Questions/Places/Experiences/K-Contents/K-Trends cards; populated detail
coverage remains in discovery-browser. No remote/provider E2E claimed. Git may
report existing LF-to-CRLF normalization warnings; no build error/EPERM workaround.
The browser fixture found and fixed a server-only NEXT_PUBLIC URL inlining issue:
the new cache client now reuses the existing runtime server config helper.

Release revalidation (2026-10-07): lint/build, all 17 security scripts and all 7
browser suites passed again, including Sprint 9 immediate-comment/reply behavior
and mobile navigation. The same six empty-fixture detail checks were skipped;
populated discovery coverage passed. `git diff --check` passed. Browser chunks
contain neither server credential variable name; the SDK's bare `sb_secret_`
format detector is not a credential. Environment values were not inspected.
No live provider call, production test translation, UGC or remote SQL was run.

Release sequence: migration/catalog verification and server variables are now
operator-confirmed complete (2026-10-07); do not rerun the migration. Re-run local
regressions → authorized Sprint 10 commit/push → observe Vercel Git deployment →
operator-only manual E2E with existing public ko/en bodies. Confirm original preserved, cache hit quota,
errors, session expiry, hidden parent/root denial after moderation, and provider
tone/slang/emoji fidelity. Do not generate fake UGC for these tests.

## Deferred

V2 can use private preferred_language to choose button target (not silently rewrite
content). More language codes require a forward constraint/parser/UI/provider change.
Catch me up, AI replies/moderation, translation admin dashboards, live quality evals,
anonymous translation abuse controls, TTL cleanup and model-version refresh are not
implemented. Future summaries must preserve original attribution and disagreements;
the translation cache is supporting view data, never the conversation source.
