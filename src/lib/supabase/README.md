# Supabase integration

- client.ts creates the browser client with static NEXT_PUBLIC environment references.
- server.ts creates a cookie-aware server client using the normal publishable key.
- config.ts validates server-side environment presence without printing values.

Create .env.local with NEXT_PUBLIC_SUPABASE_URL and
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. There is no tracked .env.example; use the
variable names here, never real values in source. All .env files are Git-ignored.

Authentication, profiles, community, events, and editorial flows are implemented.
Protected pages and mutations use auth.getUser(); admin flows additionally query
the verified user's protected profiles.role. getSession() alone is not a server
authorization check and does not prove network reachability.

Use the offline tests under tests/ and manual staging E2E for verification.
No connection-test routes should be added to the production app.

Server Components cannot persist refreshed cookies. src/proxy.ts delegates to
proxy.ts here to refresh sessions with getClaims before rendering. Cookie updates
and deletions propagate to the current request and browser response. getUser
remains the authorization boundary in protected pages/actions. Responses are
dynamic and private/no-store; do not add shared authenticated response caching.
Review production SMTP/URL configuration in docs/DEPLOYMENT.md before launch.
Never use elevated credentials in normal application flows.
