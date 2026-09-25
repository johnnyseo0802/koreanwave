import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerConfig } from "@/lib/supabase/config";

/** Refresh only. Page/action authorization still verifies the current user/role. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cacheHeaders = new Headers();
  try {
    const { url, publishableKey } = getSupabaseServerConfig();
    // Per-request client: never share sessions between warm server invocations.
    const client = createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          // Downstream Server Components must see the refreshed session immediately.
          for (const { name, value, options } of cookiesToSet) {
            if (options.maxAge === 0) request.cookies.delete(name);
            else request.cookies.set(name, value);
          }
          // Preserve earlier chunk writes/deletions if the SDK invokes setAll twice.
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          for (const cookie of previousCookies) response.cookies.set(cookie);
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          // SSR >= 0.10 supplies these only on its first write. Do not discard them.
          for (const [name, value] of Object.entries(headers)) cacheHeaders.set(name, value);
        },
      },
    });
    // Verifies signature/expiry and refreshes near-expired sessions. Never getSession.
    // No global login redirect: public pages and confirmation callbacks stay public.
    await client.auth.getClaims();
  } catch {
    // Auth outage/config errors do not block public browsing or leak raw errors.
    // Existing getUser checks fail closed on protected pages and every mutation.
    // Preserve cookies on transient failure; SDK owns invalid-session cleanup.
  }
  for (const [name, value] of cacheHeaders) response.headers.set(name, value);
  // The global header is auth-aware on every page, even otherwise public listings.
  // Also covers callback/Server Action cookie writes performed after this Proxy.
  response.headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  // Return this exact response, including refresh and cookie-deletion headers.
  return response;
}
