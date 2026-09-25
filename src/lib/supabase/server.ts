import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServerConfig } from "@/lib/supabase/config";

/**
 * Use from Server Components, Server Actions, or Route Handlers.
 * Proxy refreshes before rendering; actions/handlers can also persist auth writes.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseServerConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. src/proxy.ts already refreshed
          // the request and response; Server Actions/Route Handlers can write here.
          // Proxy applies no-store headers to all matching app responses.
        }
      },
    },
  });
}
