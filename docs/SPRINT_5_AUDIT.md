# Sprint 5 implementation and verification

## Scope

Refined the existing MVP, without adding a product subsystem or changing SQL.
The checkpoint also includes earlier uncommitted MVP implementations since e6611c1.

- Fixed missing tablet navigation, keyboard Escape/focus behavior, menu closing,
  and mobile layout. Desktop uses full navigation from 1280px; narrower widths
  use the compact menu to avoid overlap.
- Added seven information pages and repaired all footer destinations.
- Replaced invented home event schedules, author attribution and ratings with
  category navigation and a narrow real published/upcoming event query.
- Removed nonfunctional filter buttons, unsupported saved-item wording, and
  speculative contribution types. Renamed mock-content.ts to navigation-cards.ts:
  its remaining cards are navigation, not fake database content.
- Kept private profile editing, added dashboard shortcuts, retained admin checks.
- Added page metadata, private-route noindex, safe loading/error/not-found UI,
  visible keyboard focus and skip link, darker small-text accents, and KST dates.
- Added synchronous duplicate-submit guards to existing login/signup handlers.
- Preserved database migrations/seed files byte-for-byte during this sprint.

## Verification

- pnpm lint and pnpm build passed; build configuration unchanged.
- Three offline suites passed: site-security, editorial-security, events-security.
- Anonymous browser checks on 25 public routes at 375, 768, and 1440px:
  navigation, overflow, headings, metadata, keyboard menu controls.
- Protected account/write/admin paths redirected to login with internal next.
- Invalid public detail links displayed the same generic not-found UI.
- Existing public event, question, place, experience, and editorial detail links
  were checked at all three sizes. K-Trends had no public article link to test.
- Browser tests use a fresh anonymous context and block mutation HTTP methods.
- No actual signup/login, submissions, moderation, profile changes, or SQL execution.
- Authenticated dashboard/admin/private-meeting layouts were statically reviewed,
  not exercised with a real member/admin session.
- Source and staging were checked for environment files, key material, diagnostics,
  wildcard selects, and unsafe HTML. No sensitive files are included.
- .env.local and QA screenshots remain ignored.

## Release gates

See DEPLOYMENT.md. Production SMTP, real support/operator policies, reviewed
expired-session cookie refresh, and authenticated staging E2E remain launch gates.
A passing build and anonymous smoke tests are not a production-readiness claim.

## Files changed in Sprint 5

- README.md
- docs/DEPLOYMENT.md
- src/app/about/page.tsx
- src/app/account/events/page.tsx
- src/app/account/layout.tsx
- src/app/account/page.tsx
- src/app/admin/answers/page.tsx
- src/app/admin/layout.tsx
- src/app/admin/questions/page.tsx
- src/app/admin/reviews/page.tsx
- src/app/articles/[id]/page.tsx
- src/app/auth/confirmation-failed/page.tsx
- src/app/auth/confirmed/page.tsx
- src/app/auth/layout.tsx
- src/app/cancellation/page.tsx
- src/app/community/page.tsx
- src/app/community/questions/[id]/page.tsx
- src/app/community/questions/page.tsx
- src/app/community/reviews/page.tsx
- src/app/contact/page.tsx
- src/app/error.tsx
- src/app/event/[id]/page.tsx
- src/app/events/page.tsx
- src/app/faq/page.tsx
- src/app/globals.css
- src/app/k-contents/dramas/page.tsx
- src/app/k-contents/movies/page.tsx
- src/app/k-contents/music/page.tsx
- src/app/k-contents/page.tsx
- src/app/k-trends/beauty/page.tsx
- src/app/k-trends/fashion/page.tsx
- src/app/k-trends/food/page.tsx
- src/app/k-trends/page.tsx
- src/app/layout.tsx
- src/app/loading.tsx
- src/app/local-korea/experiences/page.tsx
- src/app/local-korea/page.tsx
- src/app/local-korea/places/page.tsx
- src/app/login/page.tsx
- src/app/not-found.tsx
- src/app/page.tsx
- src/app/privacy/page.tsx
- src/app/safety/page.tsx
- src/app/signup/page.tsx
- src/app/terms/page.tsx
- src/app/write/layout.tsx
- src/app/write/page.tsx
- src/app/write/question/page.tsx
- src/components/answer-moderation-queue.tsx
- src/components/application-moderation-queue.tsx
- src/components/content-card.tsx
- src/components/editorial-content.tsx
- src/components/event-shell.tsx
- src/components/home-events.tsx
- src/components/information-page.tsx
- src/components/local-content.tsx
- src/components/login-form.tsx
- src/components/mvp-listing-page.tsx
- src/components/profile-form.tsx
- src/components/public-answers.tsx
- src/components/public-reviews.tsx
- src/components/question-moderation-queue.tsx
- src/components/review-moderation-queue.tsx
- src/components/section-heading.tsx
- src/components/signup-form.tsx
- src/components/site-footer.tsx
- src/components/site-header.tsx
- src/lib/information-pages.ts
- src/lib/navigation-cards.ts
- src/lib/supabase/README.md
- tests/site-browser.mjs
- tests/site-security.mjs
- src/lib/mock-content.ts (renamed, not discarded)
- docs/SPRINT_5_AUDIT.md (this report)

SQL files in the checkpoint originate from earlier sprints and were not altered here.
