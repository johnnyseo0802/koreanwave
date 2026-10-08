# Sprint 10.3 — translation latency investigation

2026-10-09. Instrumentation only; no model, prompt, UI, timeout, cache key, RLS,
RPC, quota, moderation or production configuration changes. No migration required.
No live OpenAI calls or production measurements performed. No claimed speedup.

## Findings from the actual path

The Server Action authenticates with getUser, reads authoritative public content,
detects language and hashes the original, reads cache, claims a lease on a miss,
calls Responses, rechecks the source, finalizes cache, then rechecks before delivery.
No provider call on a cache hit, same-language request, unknown language, auth
failure, busy lease or quota rejection. Browser-memory reuse makes no server call.

Each source check needs one query for a post, two for a root comment, and three for
a reply (comment, approved post, approved root in the same post). These are serial.
Ignoring token refresh/proxy work, an ordinary successful cache miss needs:

| Content | Supabase calls | OpenAI calls |
| --- | ---: | ---: |
| Post | 7 | 1 |
| Root comment | 10 | 1 |
| Reply | 13 | 1 |

A normal cache hit needs 4 / 6 / 8 Supabase calls respectively, no OpenAI call.
The repeated visibility checks are intentional. Do not remove them to save latency.
The provider is non-streaming, with a 20-second fetch timeout and 8192 output-token
ceiling; the latter is a ceiling, not a request to generate 8192 tokens. Cache fetches
have independent 10-second timeouts. Neither bounds the entire action's duration.
The claim RPC serializes admission under one transaction advisory lock; contention
may add latency, but changing it risks quota/lease correctness and is not proposed.

UI already enters busy state immediately, disables selection/submission, guards
double clicks, retains the original, uses aria-live, and supports Show original.
It waits for the full Server Action result; the UI does not know actual server stages.
Parallel clicks on separate translations may also queue at the framework/browser
layer, outside provider latency. Never infer provider slowness from spinner time alone.

## Implemented measurements

Only the existing server-only diagnostic module writes timing events:

```json
{"event":"translation.duration","stage":"cache_read","duration_ms":12}
```

The numeric example is illustrative, not a Production result. No IDs, languages,
lengths, hashes, models, payloads, prompts, raw errors, secrets or absolute timestamps
are accepted as timing metadata. Stage is checked against a fixed allowlist at
runtime. Monotonic performance.now elapsed time is rounded to milliseconds;
nonfinite/negative readings are discarded. Duplicate stops are ignored. Broken
clocks/log sinks cannot fail the translation or prevent lease cleanup.

| Stage | Boundary |
| --- | --- |
| authentication | getUser |
| source_lookup | Initial authoritative source + parent checks |
| cache_read | Cache lookup |
| cache_claim | Claim RPC including quota/lease contention |
| provider_request | fetch initiation until response headers, or fetch rejection |
| provider_response_processing | Body download + JSON parsing + validation/extraction |
| source_recheck_before_finalize | Post-provider source/parent recheck |
| cache_finalize | Finish RPC with validated translated text |
| source_recheck_before_delivery | Final visibility/hash-equivalent text recheck |
| cache_release | Failed/changed-source lease release |
| total_request | Server Action entry through finally, including failures/early returns |

Provider request is NOT a pure inference/TTFT metric. Body consumption can include
remaining network/provider wait: sum request + processing for complete provider time.
Total includes the timed stages (do not add total to them), local work and logging
overhead, but excludes module cold initialization before entry, proxy, browser/network
round trip, framework queue and rendering. Timings are not returned to the browser.
Existing closed-vocabulary failure diagnostics remain unchanged and separate.
Stage presence alone does not prove success; interpret alongside safe failure events.
No new request correlation identifier is added. Concurrent events must not be joined
by proximity; use the hosting platform's invocation view or sequential controlled runs.

## Model assessment — proposal only

The repository reads OPENAI_TRANSLATION_MODEL with no default. Production's current
value was not inspected. Earlier operator context mentions gpt-6-luna; the conclusions
below are conditional on that still being the configured model.

Official OpenAI Docs reviewed 2026-10-09:

- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna): valid
  Responses model, focused/high-volume positioning, reasoning none through max with
  medium default. Reasonable baseline, not inherently an oversized-model mistake.
  The existing adapter does not set reasoning, so default reasoning is a plausible
  contributor, not a measured root cause.
- [GPT-4.1 Mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini): a small
  model with low latency without a reasoning step, Responses support. Proposed
  controlled comparator, NOT an automatic replacement. It is described as smaller
  than GPT-4.1, not proven smaller/faster than Luna. Docs list higher token prices
  than Luna; speed and KO/JA nuance must justify any switch. Account access unverified.
- [GPT-4.1 nano](https://developers.openai.com/api/docs/models/gpt-4.1-nano) is marked
  deprecated; do not introduce it as the new production choice.
- [Latency guide](https://developers.openai.com/api/docs/guides/latency-optimization):
  model size, output work, network serialism and perceived latency are separate levers.

Approval-gated arms: current baseline; same Luna with reasoning.effort=none; and
gpt-4.1-mini with identical translation prompt/source envelope and safety validation.
Do not assume all models accept the same optional reasoning parameters. No parameter
or model changes implemented. Keep faithful tone/slang/humor/disagreement requirements.

IMPORTANT: cache identity does NOT include model/prompt (model is stored metadata).
Changing only the model env would still return prior model's cached translation.
Use separate disposable NON-PRODUCTION cache datasets for each approved comparison
arm with identical inputs. Do not clear production caches or alter cache semantics.

## Prioritized next implementation plan

1. Approve/deploy timing-only change and obtain a baseline. Investigate the largest
   measured stage; no speculative model switch. Keep log retention/access restricted.
   New timing events add log volume; evaluate that overhead before long-term rollout.
2. If provider time dominates, run the approval-gated model/reasoning comparison.
   Reject any faster option that weakens accuracy, cultural nuance or safety.
3. If source reads dominate, parallelize the post/root lookups AFTER fetching the
   reply and obtaining its authoritative IDs. Await/check both, preserving every
   explicit approved/same-post/root filter and all three recheck boundaries. This
   reduces critical-path round trips, not query count; may query a root even when
   its post is hidden. Add race/denial tests before shipping. Not implemented here.
4. Later evaluate a single normal-session embedded relational source query, only
   after proving join/FK semantics and parent RLS filtering under member/admin users.
   No privileged reads, new SECURITY DEFINER function or RLS relaxation.
5. UX: add a factual waiting hint (first translation may take a moment, original is
   still available), preserve immediate feedback and allow reading elsewhere. Do not
   invent stage progress/ETA, auto-retry, auto-translate or clear the original.

Do NOT simply remove cache.read in favor of claim: cache hits currently work without
provider configuration, and claim takes the shared lock. An apparent one-call saving
could worsen hit latency and change availability. Do not parallelize provider calls
with claim or visibility checks. Do not deliver streamed/unvalidated output before
the post-provider checks, or finalize cache asynchronously after reporting success.
Do not reduce output limits blindly: incomplete translations must remain failures.

## Cold versus cached measurement plan (not executed live)

Use approved synthetic/nonpersonal evaluation material in an isolated staging setup;
never create fake Production activity. Live provider evaluation requires approval
and a capped budget. Do not export HAR bodies, headers, prompts or private logs.

- Six directions: KO→EN, KO→JA, EN→KO, EN→JA, JA→KO, JA→EN.
- Cover posts, root comments and replies; short 20–150, medium 151–500, long 501–2000
  characters; include slang, sarcasm, honorifics, cultural references, disagreement,
  emoji and dominant mixed-language examples. Keep ambiguous/very short cases as
  no-provider controls. Human bilingual reviewers assess fidelity/omissions/tone.
- Distinguish: (a) fresh server instance + cache miss, (b) warm instance + cache miss,
  (c) persisted cache hit after page reload, (d) same mounted UI memory hit. Label
  cold start only if hosting evidence confirms it; idle time alone is not proof.
- For each direction, start with at least 10 distinct cache-miss samples, then their
  repeat cache-hit controls. Respect unchanged 5/min, 20/day/member, 500/day limits;
  spread runs across days rather than disable limits or manufacture accounts. Larger
  samples are needed before treating p95 as stable. No quota bypass in test harness.
- Separate runs by language/length/model arm in an offline aggregate worksheet; no
  identifying metadata is added to application logs. Collect count, median/p95 and
  failure rate, stage durations and browser click-to-render duration. Record only
  aggregate durations/quality scores; do not export content or identities.
- Assert cache hits have no provider/claim/finalize stages; UI memory hits have no
  server events. Race-to-hit claim is a distinct path. Compare all six directions
  and mobile 390x844 / short-screen 390x320 to desktop, same region/network cohort.
- Examine stage totals versus browser duration to separate backend time from cold
  start/network/queue/render. Provider duration is a combined measurement, not pure
  model compute. Keep model/provider prompt caches separate from our application cache.
- Require no regression in hidden-source/hidden-parent denial, source edits, lease
  fencing, quotas, duplicate clicks, error fallback, original text and log privacy.
  Decide a measurable latency improvement threshold before the experiment (e.g.
  20% p95 reduction with no critical fidelity errors); this is a target, not a result.

## Automated coverage

translation-timing-security uses a fake monotonic clock and actual action/provider
code with local mocks: all six cold/hit paths, header/body timing separation, invalid
request/auth/unknown early exit, claim hit/busy/limit, network/HTTP/JSON failures,
hidden-source release, zero-row finalization, logger/clock failures and redaction.
Fixture durations verify boundary accounting only, not real latency. Existing
translation, DB/security and browser/mobile suites cover preserved semantics.

Local verification: lint and build PASS; all 20 security suites PASS; translation
browser (six directions), mobile-navigation browser, and conversation browser PASS.
git diff --check PASS. Only fixtures/isolated DBs were used. No live measurements,
Production writes/settings, commit or push. Implementation changes are restricted
to timing; network/UX/model optimizations above remain proposals awaiting approval.

Release recheck: lint, 20 security suites and the three browser suites passed again.
The standard Windows build hit an existing .next EPERM unlink lock. Build and browser
checks passed with temporary distDir .next/release-10-3-timing; normal next.config.ts,
tsconfig.json and generated next-env.d.ts were restored afterward. No build artifacts
are included in the release. No live provider calls or production mutations performed.
