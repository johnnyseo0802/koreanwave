# Sprint 9.1 — Real-time conversation, moderation by exception

**REAL-TIME BY DEFAULT. MODERATION BY EXCEPTION.** This revision replaces the
then-unapplied Sprint 9 draft, not an already-deployed migration. Ordinary comments
and replies publish immediately; reports and human moderation address abuse.

## Product and audit decisions

The product is current Korea, people, participation and real experiences—not an encyclopedia. Discover → react → comment → discuss → return → experience → share. Disagree with ideas; moderate attacks on people. Strong opinions, humor and disagreement are welcome; harassment, threats, hate, sexual harassment and spam are not.

Audited the existing posts/Helpful/reports/prompt/own-contributions system, private profiles, Questions/Answers, Reviews, editorial articles, local entities, Events and clusters, admin verification, SSR sessions and media policies. Reuse those systems. Questions retain Answers; Places retain Reviews. No duplicate article-comment silo or generic social graph.

Important privacy conflict: profiles are private and have no public-attribution consent. **No display name, country, avatar, email or auth UUID is exposed.** Comments say Community member or You (own IDs resolved server-side). Discussion posts explicitly identify their operator origin. Recognizable member identity remains a separately reviewed future change, not a reason to widen profile access.

Content principles:

- INFORMATION: accurate, concise, useful.
- EDITORIAL: human voice, perspective, firsthand experience where genuine.
- COMMUNITY: opinions, disagreement, humor, questions, experiences, conversation.
- AI: assistant/editor/moderator/translator—not a fake member. No fabricated users, activity counts, comments or reactions.
- IMAGE PRIORITY: (1) firsthand real photo; (2) rights-cleared member photo; (3) authorized partner photo; (4) properly licensed real photo; (5) AI editorial image only when appropriate. Never represent AI imagery as documentary photography of a real place or event.

## Migration — operator-applied; do not rerun

`supabase/migrations/20261005000000_community_conversations.sql` is one transaction, forward-only and deliberately not rerunnable. On 2026-10-05 the operator confirmed Production application and verification: comments/article links exist, discussion type and comment RLS are enabled, authenticated INSERT of status/published_at is denied, and anon/authenticated SELECT of author_id is denied. Production migration is CLOSED. Finalization does not alter or rerun the SQL. No seeds, fake UGC, application secrets or privileged application clients.

- Adds `discussion` to the existing post taxonomy. Member insert is restricted; only authenticated admins may create discussions. Creation remains pending; existing Community moderation approves it.
- Extends the existing post transition to allow admin approved → rejected (terminal hide). Pending → approved/rejected and approved feature toggles remain. Hiding clears publication/featured state. No content editing or restore UI.
- Adds `community_comments`: post FK, optional parent, private author default `auth.uid()`, plain-text body 2–2,000 trimmed Unicode characters, pending/approved/rejected, DB-managed timestamps. `approved` means publicly visible, not necessarily manually reviewed. Default and BEFORE INSERT trigger set approved; the trigger sets published_at to the DB statement time. RLS WITH CHECK runs after the trigger and requires approved/non-null publication time plus ownership/context. A composite FK requires same-post parent; trigger requires an approved root in an approved post. No third level. The trigger locks parent rows during insert and permits no late submission after concurrent hiding wins the lock.
- Reuses `community_helpful` with `reaction_type` helpful/like/interesting/agree. Composite PK `(post_id, member_id, reaction_type)` prevents duplicates. Legacy Helpful rows get unknown/epoch activity dates; new reactions get DB time. Existing Helpful count/delete paths isolate helpful from other kinds.
- Extends existing reports with nullable comment reference, same-post composite FK, separate post/comment uniqueness. Uses existing report reasons and admin resolve action.
- Adds `article_discussions`: one existing discussion per article, with foreign keys; multiple related articles may intentionally share a discussion. Admin may replace the link with a compare-and-swap check. This does not publish either object.
- Thread/author/queue/parent, recent reaction, report uniqueness and article-link indexes support bounded MVP reads.

No changes to Questions/Answers, profiles, Auth, local entity/event schemas, clusters, Storage bucket configuration or Storage policies. No new environment variables. The post hide rule intentionally also revokes future anonymous media access through the existing approved-parent predicate; a previously delivered image cannot be retroactively removed from a visitor's device.

### Grants AND RLS

| Object | Public | Authenticated member | Admin |
|---|---|---|---|
| Comments | Approved with approved post/root; explicit safe columns | Same plus own pending/rejected in valid public context; INSERT only post/parent/body | Read queue; UPDATE status only |
| Reactions | Aggregate RPC only | Own safe rows; INSERT post/type; own DELETE | Same member behavior; no voter listing |
| Reports | No read/write | INSERT post/comment/reason/details; reporter cannot be forged | Existing private read/resolve, now with post/root/comment context |
| Article links | Both published article and approved discussion required | Same public read; no mutation | Create/replace/remove links under RLS |

No comment API grant for author/id/created/updated/published/status INSERT, author SELECT, body UPDATE or DELETE. `status` UPDATE column grant is constrained by admin RLS and trigger transitions. No table-level write broadening. Members cannot create discussion posts even by calling the API directly. Existing Helpful self-reaction prohibition is retained.

Public application reads explicitly filter approved comments/posts and published article links even for admins. The latest root comments are fetched first (30); the latest replies reference only those approved roots (100). Each bounded window renders chronologically, so new comments/replies are not excluded behind an oldest-first window. Own pending/rejected comments (50) are private server-rendered context, not author UUIDs. Hidden roots make their replies unavailable publicly and to unrelated members; hiding the post hides the entire conversation, own preview and aggregates. Admin can still review moderation context.

### Database helpers

New definers live in **`conversation_private`**, not `public`. Do **not** add this schema to Supabase Data API exposed schemas. All use `search_path=''`, fully qualified objects, revoked PUBLIC execute and minimum roles:

- `comment_context(post,parent)`: anon/auth boolean for approved context; avoids recursive comment RLS. Returns no private content/identity.
- `comment_transition()`: trigger only; no API execute. Locks/validates parent, enforces a serialized per-member maximum of five submissions per minute, and manages dates/transitions.
- `activity()`: anon/auth approved-only public aggregates; no identity projection.
- `reaction_counts(target)`: anon/auth counts for approved posts only.
- `own_comments(target)`: authenticated only, hard-coded `auth.uid()` ownership, safe columns and valid parent context; no caller-supplied user.

Public new RPCs are SECURITY INVOKER wrappers with fixed signatures and bounded results: `conversation_activity`, `trending_conversations`, `conversation_reaction_counts`, `my_conversation_comments`. The existing public Helpful-count definer is updated only to isolate Helpful; its original ACL is retained. No new exposed SECURITY DEFINER identity RPC.

### Safety / pre-apply review

- Sprint 7's first unnamed table CHECK is `community_posts_check`. The isolated test applies the complete actual Sprint 7 migration first and verifies the replacement succeeds. Operator should confirm this name and definition in the production catalog before applying; unexpected name/rows fail and roll back, rather than dropping a guessed constraint.
- Existing moment/story/tip checks are retained. Existing Helpful data is retained. The only backfill is new reaction kind/default and unknown historical activity time.
- Existing reports get null comment IDs; old uniqueness is replaced with equivalent post-only and separate comment uniqueness indexes.
- FK deletion behavior: deleting a post/author administratively cascades comments and descendants/reports; deleting an article or post removes its link only, not the other target. Members have no delete grant. There is no destructive table DROP or seed.
- Default privileged database owners still bypass RLS. Never distribute those credentials. No service key is used in these application flows.
- On failure the transaction rolls back. After successful rollout do not blindly roll back tables containing member data; prefer a separately reviewed forward fix and, if necessary, disable the affected UI first.

## UI and moderation workflow

1. Admin → Conversations → Discussions: write a genuine operator prompt; it enters the existing pending Community queue. Approve there.
2. In Article → conversation, select an existing article and approved Discussion. Draft articles stay private. Existing public article details show “Join the conversation” → the shared community thread; unlinked articles show a neutral Community CTA, never fabricated participation.
3. Approved community post detail: anonymous readers see approved comments and login return CTA. Authenticated members may react, write a comment, reply to a root, and report. Server actions reverify auth and approved post/root. INSERT payload has only post, parent, body; identity comes from DB `auth.uid()`.
4. Ordinary valid comments/replies immediately enter approved/public state, determined in the DB—not form input or metadata. Success replaces the composer with “Your comment is live.” / “Your reply is live.” and revalidates/refreshes the server-rendered conversation. Counts and limits remain server-validated. This is immediate publication plus refreshed UI, not a new WebSocket/subscription system; other visitors see changes on their next refresh/navigation.
5. Admin → Conversations defaults to reports and retains live (approved), hidden/rejected and future held/pending queues with post/root context. Ordinary comments require no approval. Admin may hide a live comment/root; a root hide hides its reply subtree. Hiding is terminal under the current model, and stale/zero-row updates fail. Neither reporting nor marking a report reviewed automatically hides content. No report-count auto-hide. Approved posts can be hidden from a reported-post context. Existing post/Discussion creation and approval are unchanged by the comment-only publication revision.

## Future member enforcement — design only

Normal → Watch → Restricted → Suspended is a future **private, server/DB-owned**
enforcement model, not the current profile role and never client-supplied metadata.

- Normal: immediate publication (implemented default).
- Watch: immediate publication with additional human moderation attention.
- Restricted: trusted hold decision; future pending/pre-moderation.
- Suspended: future write prohibition, enforced independently in DB policies/triggers.

No trust-state columns, reputation/points system, warnings, automatic penalties or
suspension UI are implemented. `pending` is retained for future held content and
admin review, but current API inserts cannot choose it. A future hold/block design
must revise the trusted DB publication decision and matching INSERT policy together;
merely sending status from a client is never acceptable. It must apply to direct
Data API writes too, not only the application action. No such bypass is introduced.

## Future optional AI moderation — design only

Potential application insertion point: authenticated, validated submission →
moderation classifier → allow / hold / block → DB. A provider result must be
validated server-side and mapped to a reviewed DB enforcement mechanism so direct
API writes cannot bypass it. The current trigger intentionally publishes valid
normal submissions; it does not accept classifier decisions. No provider, secret,
network call or classifier is added now. AI must not be the sole irreversible
authority: a future design needs human review/appeal and reversible holds before
irreversible actions. Current admin reporting/hiding remains available independently.

Plain text is React-escaped, never HTML/Markdown execution. Raw Supabase errors stay hidden. Ref locks/disabled controls prevent repeated clicks while submitting; successful comment/discussion forms are replaced. No guarantee of exactly-once insertion across multiple tabs or transport retries: after an uncertain failure users are told to refresh and check their contributions. DB rate limits provide an additional independent burst control.

## Trending

For each approved post:

1. `participants` = DISTINCT member union of approved, visible comments published in the last seven days and reactions created in the last seven days; exclude the post author. An account counts once across all types/comments.
2. `last_activity` = max(post publication, visible approved comment/reply publication).
3. `score = (3 * min(participants, 50) + (last_activity within 2 days ? 1 : 0)) / (1 + age_seconds(last_activity) / 172800)`.
4. Sort score DESC, last_activity DESC, post UUID ASC for deterministic ties; maximum 30. Home shows four.

Visible totals are actual approved comments/replies and all real reactions (including legacy Helpful); they are not ranking weights. Reaction toggle churn cannot multiply an account's weight or reset publication activity. Old activity decays, old votes expire from ranking, no lifetime-popularity lock-in. No claim of Sybil resistance: account farms remain an operational risk. Seven-day window + per-account de-duplication + comment burst cap are MVP safeguards, not a full anti-abuse service.

No synthetic empty-state content. With zero conversations invite a real contribution; on query error show unavailable. Community adds Trending/Latest/Discussions while retaining Questions/Moments/Stories/Tips/Reviews. Upper-home “What’s happening” uses the same aggregate/read path. Read-only aggregates scan approved content; measure production query plans as volume grows before introducing materialization/caching. No caching of private/session-specific data.

## Mobile and tests

One reply indent only, wrapping long body text, stacked forms, 44px+ reaction/report targets, native form labels and keyboard focus. No public usernames exist to overflow; long text is tested. Short screens scroll naturally; header behavior is unchanged.

Local-only verification commands (no remote environment access by new suites):

```
node tests/conversation-db-security.mjs
node tests/conversation-security.mjs
node tests/conversation-browser.mjs
pnpm lint
pnpm build
```

DB suite uses existing ignored PGlite runtime (`PGLITE_MODULE_PATH` override optional), actual Sprint 7 + Sprint 9 SQL, isolated fixture roles/data. Browser uses installed Playwright (`PLAYWRIGHT_MODULE_PATH` optional), local fixture API at 4062 and built Next at 4061. All writes remain in that process's in-memory arrays; external browser requests are blocked. Screenshots go to ignored `.next/conversation-qa`. Also rerun all existing security suites, editorial/privacy, Sprint 7 community/media, Sprint 8 clusters, discovery and mobile-navigation browser tests.

Set `RUN_SITE_BROWSER=1` when running the conversation browser suite to also run
the existing general site browser test against that same local API. Empty fixture
detail links are explicitly skipped there; populated editorial/local/event detail
coverage remains in the existing discovery browser suite. The new SQL tests prove
immediate anonymous visibility, client status/date denial, live hiding, subtree
privacy, no report auto-hide, retained rate limits, and private future-held rows.

Sprint 9.1 revised the existing **then-unapplied** migration in place; there is no second
migration and no backfill of production rows. Revision files: the migration,
community conversation action, composer/report controls, conversation renderer and
DAL, admin conversation page (reports default), the three conversation tests, and
this document. No Auth, Storage, profile or unrelated product edits in this revision.

## Production rollout

1. Maintain `conversation_private` outside exposed Data API schemas and retain the reviewed grants/profile/Storage boundaries.
2. Migration application and operator verification are complete. Do not rerun or modify the applied migration. No automatic production writes or fake seed.
3. Commit/push is authorized for finalization after local regressions pass. After the Git-integrated deployment, run anonymous/member/admin E2E on legitimate operator/member content with permission, including cross-post reply denial, private author/voter columns, root/post hiding, reports, article draft/link privacy and unique reaction behavior.
4. Confirm existing Questions/Answers, My Contributions, profiles/Auth, Events/private meeting details, Storage and cluster behavior. No required SMTP/Auth/environment changes from Sprint 9.
5. Operators author real discussion prompts and connect suitable editorial articles. No AI personas or fabricated participation.

Future work requires separate review: explicit public-attribution consent, incremental thread pagination, a broader own-comments index in My Contributions, aggregation optimization, and moderation assistance. DM/follow/matching/payments/notifications/AI generation are not part of this sprint.

## Change inventory

New:

- `supabase/migrations/20261005000000_community_conversations.sql`
- `src/lib/conversation.ts`
- `src/lib/conversation-data.ts`
- `src/app/community/conversation-actions.ts`
- `src/components/conversation.tsx`
- `src/components/conversation-controls.tsx`
- `src/components/conversation-admin.tsx`
- `src/app/admin/conversations/page.tsx`
- `src/app/admin/conversations/actions.ts`
- `tests/conversation-security.mjs`
- `tests/conversation-db-security.mjs`
- `tests/conversation-browser.mjs`
- This document.

Integrated/updated:

- `src/app/page.tsx`
- `src/app/community/page.tsx`
- `src/app/community/posts/[id]/page.tsx`
- `src/app/community/actions.ts` (Helpful-kind isolation only)
- `src/app/articles/[id]/page.tsx`
- `src/app/admin/community/page.tsx`
- `src/components/admin-moderation-nav.tsx`
- `tests/discovery-browser.mjs`
- `tests/clusters-browser.mjs`
- `tests/mobile-navigation-browser.mjs`

The three existing fixture servers now explicitly recognize the read-only trending RPC POST. Other unexpected POST/mutation requests are still rejected and counted. No production verification scripts or env/config files were changed.
