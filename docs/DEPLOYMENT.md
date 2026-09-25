# MVP deployment checklist

## Current status: public launch is gated

The application builds, but these items need operator review before public use.
No deployment, remote schema change, or production data mutation was performed.

1. **Email delivery:** Previous setup used Supabase default SMTP. Confirm a
   production sender before opening registration. Default SMTP is for testing and
   restricts recipients; a developer confirmation test does not demonstrate public
   signup delivery. Do not disable confirmation as a workaround.
   [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
2. **Session refresh:** Next.js 16 uses src/proxy.ts and a per-request Supabase SSR
   client. getClaims refreshes expiring sessions; cookie writes reach both the
   current render and browser response. Page/action authorization still uses
   getUser, with a separate profiles.role check for admins. Offline tests cover
   expired, near-expired and invalid refresh tokens. Verify cold expiry on the
   actual HTTPS deployment before public launch.
   [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
3. **Operator/contact/policies:** Publish a verified support channel and operator
   identity. Establish abuse/privacy/deletion and event cancellation handling.
   Contact, Privacy, Terms, and Cancellation currently describe limitations, not
   final legal guarantees. Finalize these notices before public operations.
4. **Remote schema:** Confirm intended migrations and staging RLS checks. Repository
   code cannot prove the current deployed policies. Do not rerun applied migrations
   or seeds blindly. This sprint did not modify SQL history or policies.
5. **Manual authenticated E2E:** Recheck signup/confirmation, cold token expiry,
   login/logout, profile, contributions, moderation, application privacy, approved
   meeting details, and editorial publish/unpublish/stale edits. Offline mocks and
   anonymous browser checks do not replace authenticated E2E.

## Vercel setup — not executed

- Import the repository with the Next.js preset and repository-root project path.
- Use packageManager-pinned pnpm and a compatible Node release; build with pnpm
  build and retain default Next.js output. Do not static-export this SSR app.
- Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for
  the intended Preview/Production environments. Prefer isolated staging data for
  previews. Never add elevated keys. Public-prefixed values are bundled at build
  time: rebuild when they change.
  [Vercel environment variables](https://vercel.com/docs/environment-variables)
- After choosing the deployment origin, update Supabase Site URL and allowed
  confirmation redirect URLs explicitly. Preserve the default ConfirmationURL flow.
- Protect preview deployments and verify HTTPS, confirmation, and cookie behavior.
- Add canonical/social metadata and a sitemap once the real public origin and
  indexing policy are confirmed. No invented domain is configured now.
- Confirm event logistics before publishing. The October 2026 seed is not a recurring
  schedule; do not automatically execute it during deployments.

## Security and operations

### Production Auth configuration (operator action; not performed)

- Configure custom SMTP in Supabase Authentication email settings before public
  signup: verified sender/domain, sender address/name, SMTP host/port, TLS and
  provider credentials. Enter secrets only in the provider/Supabase dashboard;
  never commit them or add them to browser-prefixed environment variables.
- Set Supabase Authentication URL Configuration Site URL to the exact HTTPS
  production origin, for example https://<production-host> (replace the placeholder).
- Add https://<production-host>/auth/confirm to Redirect URLs. The signup form uses
  its current browser origin plus /auth/confirm. Avoid broad production wildcards.
  Allow each intentional preview/staging origin explicitly; localhost entries are
  only for development. Do not assume arbitrary Vercel previews are authorized.
- Keep the default {{ .ConfirmationURL }} email template. /auth/confirm accepts
  the browser fragment flow and forwards PKCE code callbacks to
  /auth/confirm/server. PKCE needs the initiating browser's verifier cookie; opening
  a link in a different browser can fail safely. Failure goes to
  /auth/confirmation-failed, success to /auth/confirmed. Sensitive URL data is
  cleared; arbitrary next destinations are not forwarded.
- No template change is required for SMTP. If deliberately adopting a TokenHash
  template later, point it at /auth/confirm/server with token_hash and type=signup
  (or email); review and allowlist that exact callback URL at that time.
- In Vercel Production (and separately Preview), set NEXT_PUBLIC_SUPABASE_URL and
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for the intended project before building.
  Rebuild after changing these values. Do not add service_role/secret credentials.
- Do not add ISR, shared HTML caching or CDN overrides to authenticated responses.
  Root rendering is dynamic; Proxy marks matched responses private/no-store,
  including CDN headers. Preserve Set-Cookie through any additional reverse proxy.
- Never log callback query strings, cookies or Authorization headers in custom
  analytics, monitoring or reverse proxies. Test confirmation, cold refresh and
  logout manually on HTTPS with an operator-controlled account.

Offline security tests (no credentials or remote writes):

    node tests/site-security.mjs
    node tests/editorial-security.mjs
    node tests/events-security.mjs
    node tests/ssr-auth-security.mjs

- Public queries explicitly filter approved/published rows and narrow columns.
- Admin pages/actions recheck the current user and protected profiles.role.
- Public pages omit author identities and private participation information.
- Own applications are explicitly scoped to the authenticated user, even for admins.
- Meeting details require own approval; RLS remains authoritative.
- No production SELECT *, raw DB error display, console diagnostics, or test endpoints.
- .env.local, build outputs, and screenshots remain Git-ignored.
- Use external editorial images only with permission; browsers contact their hosts.
- Plan backups, retention, incidents, rate limits, and monitoring without logging
  tokens, passwords, private meeting instructions, or complete submitted forms.

## Windows build notes

Sandbox spawn EPERM requires permission for build worker processes; it is different
from a OneDrive cache-lock error. For a cache-lock issue, use a fresh temporary
directory under ignored .next and restore configuration afterward. Preserve existing
caches and source. Sprint 5's build needed no directory override.
