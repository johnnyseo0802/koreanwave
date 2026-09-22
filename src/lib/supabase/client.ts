import { createBrowserClient } from "@supabase/ssr";

export class SupabaseBrowserConfigurationError extends Error {
  constructor() {
    super("Supabase browser configuration is incomplete.");
    this.name = "SupabaseBrowserConfigurationError";
  }
}

export function isSupabaseBrowserConfigurationError(error: unknown): error is SupabaseBrowserConfigurationError {
  return error instanceof SupabaseBrowserConfigurationError;
}

/**
 * Use from Client Components when browser access to Supabase is needed.
 * The publishable key is intentionally the only key available to this client.
 */
export function createClient() {
  // These references must stay static. Next.js inlines NEXT_PUBLIC_* values
  // into browser bundles, whereas computed environment lookups are not supported.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new SupabaseBrowserConfigurationError();
  }

  return createBrowserClient(url, publishableKey);
}
