# Korean Wave Community

Mobile-first Next.js App Router + TypeScript + Supabase MVP for Korean culture,
local discovery, moderated community contributions, and events.

## Local development

Use the pnpm version declared in package.json and a Node version supported by
the installed Next.js release (verification used Node 24).

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm build
pnpm start
```

Create a local .env.local with your own values for:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Do not commit that file, paste values into source, or use elevated credentials.
Browser environment references are deliberately static for Next.js bundling.

## Implemented MVP

- Email/password authentication, email confirmation, private editable profile.
- Server-protected account/contribution routes and safe internal login returns.
- Questions, answers, reviews with admin moderation before public publication.
- Published places, experiences, editorial articles, and events.
- Event applications and approved-own-participant meeting instructions.
- Admin queues and a unified K-Contents / K-Trends editorial editor.
- Information pages, compact navigation, and public event home preview.

No payments, social login, direct messages, public profiles, or saved items.
Question/review editing, account deletion, password recovery, and application
cancellation are not self-service features in this MVP.

## Database changes

Migrations and seed SQL are reviewed artifacts, not automatically run on startup
or build. Never run seeds or migrations against production as a test. Database
grants/RLS remain authoritative; application checks add another layer.

## Safe verification

```sh
node tests/site-security.mjs
node tests/editorial-security.mjs
node tests/events-security.mjs
```

These are offline static/mock tests. They never load environment values or write
database rows. tests/site-browser.mjs additionally uses Playwright and installed
Microsoft Edge with a new anonymous context against localhost. It blocks mutation
HTTP methods, checks 375/768/1440px layouts and navigation, and saves screenshots
under ignored .next/site-qa/. Provide PLAYWRIGHT_MODULE_PATH if using an external
Playwright installation; QA_BASE_URL defaults to http://localhost:3000.

## Release status

Buildable is not the same as ready for public operations. Review
[the deployment checklist](docs/DEPLOYMENT.md) before enabling public access.
No deployment or remote database migration is performed by this project setup.
