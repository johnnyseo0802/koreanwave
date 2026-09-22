import "server-only";

type SupabaseServerConfig = {
  url: string;
  publishableKey: string;
};

function getRequiredEnvironmentVariable(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Supabase environment variable: ${name}`);
  }

  return value;
}

/**
 * Server-only environment access. Browser clients must use static
 * NEXT_PUBLIC_* references so that Next.js can inline them at build time.
 */
export function getSupabaseServerConfig(): SupabaseServerConfig {
  return {
    url: getRequiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: getRequiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}
