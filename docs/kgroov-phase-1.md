# KGROOV Phase 1 — local implementation

## Scope and boundaries

Bright editorial layout: Ink #171717, Ivory #F6F5F0, Lime #D9FF70 and white.
Code-authored wordmark, hero graphic, icon and Open Graph image introduce no external asset licensing dependency.
Existing published media continues through the existing image allowlist/failure handler; its publication rights remain the operator's responsibility.

No database, migration, RLS, authentication, translation provider/cache, environment or deployment changes.
Existing Sprint 10.4–10.6 working changes are independent and retained. conversation.tsx is untouched.
The current Vercel canonical origin remains unchanged. kgroov.com is a future, separately approved domain rollout.
UI remains English; existing Korean/English/Japanese conversation translation is preserved, not replaced with a new site-language switch.

## Content composition

- Hero: brand message, existing GET search, Local Korea and Community links.
- Trending Now: bounded latest published K-Contents, Food and Local Korea Guides; explicitly labeled editorial recency, not invented popularity.
- Featured Lifestyle: published Beauty/Fashion articles, plus an Experiences navigation link. No inference that unrelated content is sports/self-care.
- Community Conversations: existing approved-only trending DAL/RPC and real comment/reaction counts. No synthetic activity.
- Supporting Places, Experiences, Ask a Local/living questions, Events, public clusters and founding-member links.
- Empty and read-error states instead of fake content. Content weights remain editorial planning guidance, not schema/ranking changes.

## Changed/new files

- src/lib/brand.ts
- src/app/globals.css
- src/app/page.tsx
- src/components/home-editorial.tsx
- src/components/site-header.tsx
- src/components/site-footer.tsx
- src/components/content-image.tsx
- src/components/cluster-content.tsx
- src/app/layout.tsx
- src/app/opengraph-image.tsx
- src/app/icon.svg
- src/lib/public-metadata.ts
- src/components/information-page.tsx
- src/components/mvp-listing-page.tsx
- src/components/signup-form.tsx (display copy only)
- src/lib/information-pages.ts
- src/app/account/page.tsx (display copy only)
- src/app/loading.tsx
- src/app/explore/page.tsx
- src/app/explore/[slug]/page.tsx
- src/app/founding-members/page.tsx
- tests/kgroov-security.mjs
- tests/discovery-browser.mjs
- docs/kgroov-phase-1.md

## Verification / operator handoff

Run lint, production build, all *security.mjs suites and existing local fixture browser suites.
Discovery browser covers 375/768/1440px, branding, Lifestyle classification, real links, safe drafts, image failure fallback, search, existing editorial typography and zero writes/private meeting reads.
Mobile navigation browser retains real touch navigation, Account/Log in, outside dismissal, Escape/focus and short-screen scroll checks.
Browser fixtures are synthetic local-only QA, never published content or production UGC. Translation browser uses a mock provider, never a paid API call.

Before any production release: approve visual preview; review the KGROOV-only diff separately from translation work; manually verify current published imagery/content placement and logged-in navigation; obtain separate approval for commit/push/deployment. Domain/DNS/canonical/Auth redirect changes are explicitly outside this phase.

### Local verification results (2026-10-10)

- pnpm lint and pnpm build: passed. Initial sandbox build hit Windows EPERM; approved host execution succeeded with the normal .next directory, without configuration changes or destructive cleanup.
- All 24 *security.mjs suites: passed, including the new KGROOV component mock tests and existing translation/media/privacy/SSR checks. DB test suites used isolated local databases, not Production.
- discovery-browser, community-browser, clusters-browser, conversation-browser, translation-browser, mobile-navigation-browser: passed using localhost fixtures.
- Final Hero spacing correction: lint/build and 375/768/1440px discovery browser rerun.
- Local homepage and generated OG image: HTTP 200; runtime verification server stopped after checking.
- git diff --check: passed. No commit, push, deployment, domain change, production write or paid API call.
