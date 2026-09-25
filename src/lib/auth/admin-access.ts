import "server-only";
import { createClient } from "@/lib/supabase/server";

// Recheck on every page request AND mutation; never accept a client role claim.
export async function getAdminAccess() {
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { status: "unauthenticated" } as const;
    const { data: profile, error } = await client.from("profiles")
      .select("role").eq("id", auth.user.id).maybeSingle();
    if (error) return { status: "unavailable" } as const;
    if (profile?.role !== "admin") return { status: "forbidden" } as const;
    return { status: "admin", client } as const;
  } catch {
    return { status: "unavailable" } as const;
  }
}
